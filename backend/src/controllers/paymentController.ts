import type { RequestHandler } from "express";
import { randomUUID } from "crypto";
import SSLCommerzPayment from "sslcommerz-lts";
import prisma from "../prisma.ts";
import { createNotification } from "../services/notificationService.ts";

const storeId = process.env.SSLCOMMERZ_STORE_ID ?? "";
const storePassword = process.env.SSLCOMMERZ_STORE_PASSWORD ?? "";
const isLive = process.env.SSLCOMMERZ_IS_LIVE === "true";
const appUrl = process.env.APP_URL ?? "http://127.0.0.1:5001";
const frontendUrl = process.env.FRONTEND_URL ?? "http://127.0.0.1:3000";

function getSslcommerz() {
  if (!storeId || !storePassword) return null;
  return new SSLCommerzPayment(storeId, storePassword, isLive);
}

// POST /events/:id/checkout — creates an SSLCommerz payment session
export const createCheckoutSession: RequestHandler = async (req, res) => {
  const userId = req.user!.id;
  const eventId = req.params["id"] as string;

  const sslcz = getSslcommerz();
  if (!sslcz) {
    return res.status(503).json({ error: "Payment system not configured." });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      isPaid: true,
      ticketPrice: true,
      status: true,
      startsAt: true,
      registrationDeadline: true,
      capacity: true,
      club: { select: { name: true } },
    },
  });

  if (!event) return res.status(404).json({ error: "Event not found." });
  if (event.status !== "APPROVED") return res.status(400).json({ error: "Event is not open for registration." });
  if (!event.isPaid || event.ticketPrice == null) {
    return res.status(400).json({ error: "This event does not require payment." });
  }

  if (event.registrationDeadline && new Date() > event.registrationDeadline) {
    return res.status(400).json({ error: "Registration deadline has passed." });
  }

  // Check if already registered
  const existing = await prisma.eventAttendance.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  if (existing?.status === "REGISTERED") {
    return res.status(409).json({ error: "You are already registered for this event." });
  }

  // Check if already has a successful payment
  const existingPayment = await prisma.payment.findFirst({
    where: { userId, eventId, status: "succeeded" },
  });
  if (existingPayment) {
    return res.status(409).json({ error: "You have already purchased a ticket for this event." });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  if (!user) return res.status(404).json({ error: "User not found." });

  // ticketPrice is stored the same way the old Stripe integration expected it
  // (whole currency unit × 100) — SSLCommerz's total_amount wants whole Taka.
  const amountTaka = event.ticketPrice / 100;
  const tranId = randomUUID();

  const payment = await prisma.payment.create({
    data: {
      id: tranId,
      userId,
      eventId,
      transactionId: tranId,
      amount: event.ticketPrice,
      currency: "BDT",
      status: "pending",
    },
  });

  const initResponse = await sslcz.init({
    total_amount: amountTaka,
    currency: "BDT",
    tran_id: tranId,
    success_url: `${appUrl}/payments/sslcommerz/success`,
    fail_url: `${appUrl}/payments/sslcommerz/fail`,
    cancel_url: `${appUrl}/payments/sslcommerz/cancel`,
    ipn_url: `${appUrl}/payments/sslcommerz/ipn`,
    shipping_method: "NO",
    product_name: event.title,
    product_category: "Event Ticket",
    product_profile: "general",
    cus_name: user.name,
    cus_email: user.email,
    cus_add1: "Dhaka",
    cus_city: "Dhaka",
    cus_postcode: "1000",
    cus_country: "Bangladesh",
    cus_phone: "01700000000",
    ship_name: user.name,
    ship_add1: "Dhaka",
    ship_city: "Dhaka",
    ship_postcode: "1000",
    ship_country: "Bangladesh",
  });

  if (initResponse.status !== "SUCCESS" || !initResponse.GatewayPageURL) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
    return res.status(502).json({ error: "Could not start payment session. Please try again." });
  }

  res.json({ sessionUrl: initResponse.GatewayPageURL });
};

// Shared by the success redirect and the IPN callback — the redirect alone is not
// trustworthy (a browser can hit that URL without ever paying), so both paths
// independently confirm the transaction with SSLCommerz's server-to-server API
// before marking anything paid. Safe to call twice for the same transaction.
async function confirmPayment(tranId: string, valId: string) {
  const sslcz = getSslcommerz();
  if (!sslcz) return { ok: false as const, eventId: undefined };

  const payment = await prisma.payment.findUnique({ where: { transactionId: tranId } });
  if (!payment) return { ok: false as const, eventId: undefined };
  if (payment.status === "succeeded") return { ok: true as const, eventId: payment.eventId };

  const validation = await sslcz.validate({ val_id: valId });
  const isValid = validation.status === "VALID" || validation.status === "VALIDATED";
  if (!isValid) return { ok: false as const, eventId: payment.eventId };

  // Cross-check the paid amount against what we asked for, to guard against a
  // forged/mismatched val_id being replayed against the wrong transaction.
  const validatedAmount = Math.round(parseFloat(validation.amount ?? "0") * 100);
  if (validatedAmount !== payment.amount) {
    return { ok: false as const, eventId: payment.eventId };
  }

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: "succeeded", validationId: valId },
    }),
    prisma.eventAttendance.upsert({
      where: { eventId_userId: { eventId: payment.eventId, userId: payment.userId } },
      create: { eventId: payment.eventId, userId: payment.userId, status: "REGISTERED", isWaitlisted: false },
      update: { status: "REGISTERED", isWaitlisted: false },
    }),
  ]);

  const dbEvent = await prisma.event.findUnique({ where: { id: payment.eventId }, select: { title: true } });
  void createNotification(
    payment.userId,
    "PAYMENT_SUCCEEDED",
    "Ticket Confirmed",
    `Your ticket for "${dbEvent?.title ?? "the event"}" has been confirmed. See you there!`,
    `/events/${payment.eventId}`
  );

  return { ok: true as const, eventId: payment.eventId };
}

// POST /payments/sslcommerz/success — browser redirect after payment (SSLCommerz posts form data)
export const sslcommerzSuccess: RequestHandler = async (req, res) => {
  const { tran_id, val_id } = req.body as { tran_id?: string; val_id?: string };
  if (!tran_id || !val_id) return res.redirect(`${frontendUrl}/my-payments?payment=error`);

  const result = await confirmPayment(tran_id, val_id);
  const path = result.eventId ? `/events/${result.eventId}` : "/my-payments";
  res.redirect(`${frontendUrl}${path}?payment=${result.ok ? "success" : "failed"}`);
};

// POST /payments/sslcommerz/fail
export const sslcommerzFail: RequestHandler = async (req, res) => {
  const { tran_id } = req.body as { tran_id?: string };
  const payment = tran_id
    ? await prisma.payment.findUnique({ where: { transactionId: tran_id } })
    : null;
  if (payment && payment.status === "pending") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
  }
  const path = payment ? `/events/${payment.eventId}` : "/my-payments";
  res.redirect(`${frontendUrl}${path}?payment=failed`);
};

// POST /payments/sslcommerz/cancel
export const sslcommerzCancel: RequestHandler = async (req, res) => {
  const { tran_id } = req.body as { tran_id?: string };
  const payment = tran_id
    ? await prisma.payment.findUnique({ where: { transactionId: tran_id } })
    : null;
  if (payment && payment.status === "pending") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "cancelled" } });
  }
  const path = payment ? `/events/${payment.eventId}` : "/my-payments";
  res.redirect(`${frontendUrl}${path}?payment=cancelled`);
};

// POST /payments/sslcommerz/ipn — server-to-server notification, the reliable fallback
// in case the customer's browser never makes it back to success_url.
export const sslcommerzIPN: RequestHandler = async (req, res) => {
  const { tran_id, val_id } = req.body as { tran_id?: string; val_id?: string };
  if (!tran_id || !val_id) return res.sendStatus(400);
  await confirmPayment(tran_id, val_id);
  res.sendStatus(200);
};

// GET /payments/my — list current user's payment history
export const getMyPayments: RequestHandler = async (req, res) => {
  const userId = req.user!.id;

  const payments = await prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          startsAt: true,
          club: { select: { name: true } },
        },
      },
    },
  });

  res.json(payments);
};

// ── Budget handlers ────────────────────────────────────────────────────────────

// GET /clubs/:id/budget
export const getClubBudget: RequestHandler = async (req, res) => {
  const clubId = req.params["id"] as string;

  let budget = await prisma.clubBudget.findUnique({
    where: { clubId },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!budget) {
    budget = await prisma.clubBudget.create({
      data: { clubId },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          include: {
            createdBy: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  const totalIncome = budget.transactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = budget.transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + t.amount, 0);

  res.json({ ...budget, totalIncome, totalExpenses, balance: totalIncome - totalExpenses });
};

// POST /clubs/:id/budget/transactions
export const addBudgetTransaction: RequestHandler = async (req, res) => {
  const clubId = req.params["id"] as string;
  const userId = req.user!.id;

  const { description, amount, type, receiptUrl } = req.body as {
    description: string;
    amount: number;
    type: "INCOME" | "EXPENSE";
    receiptUrl?: string;
  };

  if (!description || !amount || !type) {
    return res.status(400).json({ error: "description, amount, and type are required." });
  }
  if (!["INCOME", "EXPENSE"].includes(type)) {
    return res.status(400).json({ error: "type must be INCOME or EXPENSE." });
  }
  if (typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number." });
  }

  // Upsert the budget row if it doesn't exist
  let budget = await prisma.clubBudget.findUnique({ where: { clubId } });
  if (!budget) {
    budget = await prisma.clubBudget.create({ data: { clubId } });
  }

  const tx = await prisma.budgetTransaction.create({
    data: {
      budgetId: budget.id,
      description,
      amount,
      type,
      receiptUrl: receiptUrl ?? null,
      createdById: userId,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  res.status(201).json(tx);
};

// DELETE /clubs/:id/budget/transactions/:txId
export const deleteBudgetTransaction: RequestHandler = async (req, res) => {
  const txId = req.params["txId"] as string;

  const tx = await prisma.budgetTransaction.findUnique({ where: { id: txId } });
  if (!tx) return res.status(404).json({ error: "Transaction not found." });

  await prisma.budgetTransaction.delete({ where: { id: txId } });
  res.sendStatus(204);
};

// PUT /clubs/:id/budget/allocate — admin only
export const allocateBudget: RequestHandler = async (req, res) => {
  const clubId = req.params["id"] as string;
  const { totalAllocated, fiscalYear } = req.body as {
    totalAllocated: number;
    fiscalYear?: string;
  };

  if (typeof totalAllocated !== "number" || totalAllocated < 0) {
    return res.status(400).json({ error: "totalAllocated must be a non-negative number." });
  }

  const budget = await prisma.clubBudget.upsert({
    where: { clubId },
    create: { clubId, totalAllocated, fiscalYear: fiscalYear ?? "2026" },
    update: { totalAllocated, ...(fiscalYear ? { fiscalYear } : {}) },
  });

  res.json(budget);
};
