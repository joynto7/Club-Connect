import type { RequestHandler } from "express";
import Stripe from "stripe";
import prisma from "../prisma.ts";
import { createNotification } from "../services/notificationService.ts";

const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

function getStripe() {
  if (!stripeKey || stripeKey.startsWith("sk_test_your")) return null;
  return new Stripe(stripeKey);
}

// POST /events/:id/checkout — creates a Stripe Checkout session
export const createCheckoutSession: RequestHandler = async (req, res) => {
  const userId = req.user!.id;
  const eventId = req.params["id"] as string;

  const stripe = getStripe();
  if (!stripe) {
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

  const frontendUrl = process.env.FRONTEND_URL ?? "http://127.0.0.1:3000";

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: event.title,
            description: `Ticket for ${event.title} by ${event.club.name}`,
          },
          unit_amount: event.ticketPrice,
        },
        quantity: 1,
      },
    ],
    metadata: { eventId, userId },
    success_url: `${frontendUrl}/events/${eventId}?payment=success`,
    cancel_url: `${frontendUrl}/events/${eventId}?payment=cancelled`,
  });

  res.json({ sessionUrl: session.url });
};

// POST /payments/webhook — Stripe webhook handler (raw body)
export const stripeWebhook: RequestHandler = async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.sendStatus(503);

  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;

  try {
    // req.body is raw Buffer when using express.raw()
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: `Webhook error: ${msg}` });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { eventId, userId } = session.metadata ?? {};

    if (eventId && userId && session.payment_intent) {
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent.id;

      await prisma.$transaction(async (tx) => {
        // Record the payment
        await tx.payment.upsert({
          where: { stripePaymentId: paymentIntentId },
          create: {
            userId,
            eventId,
            stripePaymentId: paymentIntentId,
            amount: session.amount_total ?? 0,
            currency: session.currency ?? "usd",
            status: "succeeded",
          },
          update: { status: "succeeded" },
        });

        // Create or update EventAttendance
        await tx.eventAttendance.upsert({
          where: { eventId_userId: { eventId, userId } },
          create: { eventId, userId, status: "REGISTERED", isWaitlisted: false },
          update: { status: "REGISTERED", isWaitlisted: false },
        });
      });

      // Notify user
      const dbEvent = await prisma.event.findUnique({
        where: { id: eventId },
        select: { title: true },
      });
      void createNotification(
        userId,
        "PAYMENT_SUCCEEDED",
        "Ticket Confirmed",
        `Your ticket for "${dbEvent?.title ?? "the event"}" has been confirmed. See you there!`,
        `/events/${eventId}`
      );
    }
  }

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
