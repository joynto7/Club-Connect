import type { RequestHandler, Response } from "express";
import { MembershipStatus, EventStatus } from "@prisma/client";
import PDFDocument from "pdfkit";
import prisma from "../prisma.ts";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildCsvRows(headers: string[], rows: string[][]): string {
  const escape = (v: string) =>
    v.includes(",") || v.includes('"') || v.includes("\n")
      ? `"${v.replace(/"/g, '""')}"`
      : v;
  const lines = [headers.map(escape).join(",")];
  rows.forEach((r) => lines.push(r.map(escape).join(",")));
  return lines.join("\n");
}

async function resolveClub(slugOrId: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
  return prisma.club.findFirst({ where: isUuid ? { id: slugOrId } : { slug: slugOrId } });
}

// ── CSV generators ────────────────────────────────────────────────────────────

async function buildMembersCsv(clubId: string): Promise<{ csv: string; name: string }> {
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  const members = await prisma.clubMembership.findMany({
    where: { clubId, status: MembershipStatus.APPROVED },
    include: { user: { select: { name: true, email: true, department: true, year: true } } },
    orderBy: { createdAt: "asc" },
  });

  const rows = members.map((m) => [
    m.user.name,
    m.user.email,
    m.role,
    m.user.department ?? "",
    m.user.year ?? "",
    fmtDate(m.createdAt),
  ]);

  return {
    csv: buildCsvRows(["Name", "Email", "Role", "Department", "Year", "Joined"], rows),
    name: `${club?.name ?? "Club"} Members`,
  };
}

async function buildAttendanceCsv(eventId: string): Promise<{ csv: string; name: string }> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  const attendees = await prisma.eventAttendance.findMany({
    where: { eventId },
    include: { user: { select: { name: true, email: true, department: true, year: true } } },
    orderBy: { createdAt: "asc" },
  });

  const rows = attendees.map((a) => [
    a.user.name,
    a.user.email,
    a.user.department ?? "",
    a.user.year ?? "",
    a.status,
    a.isWaitlisted ? "Yes" : "No",
    a.checkedIn ? "Yes" : "No",
    fmtDateTime(a.checkedInAt),
    fmtDate(a.createdAt),
  ]);

  return {
    csv: buildCsvRows(
      ["Name", "Email", "Department", "Year", "Status", "Waitlisted", "Checked In", "Check-in Time", "Registered At"],
      rows
    ),
    name: `${event?.title ?? "Event"} Attendance`,
  };
}

async function buildEventsCsv(): Promise<{ csv: string; name: string }> {
  const events = await prisma.event.findMany({
    include: {
      club: { select: { name: true } },
      _count: {
        select: {
          attendees: { where: { status: "REGISTERED", isWaitlisted: false } },
        },
      },
    },
    orderBy: { startsAt: "desc" },
    take: 500,
  });

  const rows = events.map((e) => [
    e.title,
    e.club.name,
    e.category,
    e.status,
    e.location,
    fmtDateTime(e.startsAt),
    fmtDateTime(e.endsAt),
    String(e._count.attendees),
    String(e.capacity ?? ""),
    fmtDate(e.createdAt),
  ]);

  return {
    csv: buildCsvRows(
      ["Title", "Club", "Category", "Status", "Location", "Starts At", "Ends At", "Registrations", "Capacity", "Created"],
      rows
    ),
    name: "All Events",
  };
}

async function buildSystemCsv(): Promise<{ csv: string; name: string }> {
  const [users, clubs, events, attendance, feedback] = await Promise.all([
    prisma.user.count(),
    prisma.club.count({ where: { status: "ACTIVE" } }),
    prisma.event.count({ where: { status: EventStatus.APPROVED } }),
    prisma.eventAttendance.count({ where: { status: "REGISTERED", isWaitlisted: false } }),
    prisma.eventFeedback.aggregate({ _avg: { rating: true }, _count: { id: true } }),
  ]);

  const rows = [
    ["Total Users", String(users)],
    ["Active Clubs", String(clubs)],
    ["Approved Events", String(events)],
    ["Total Registrations", String(attendance)],
    ["Feedback Submissions", String(feedback._count.id)],
    ["Avg Feedback Rating", feedback._avg.rating ? String(Math.round(feedback._avg.rating * 10) / 10) : "—"],
    ["Generated At", new Date().toISOString()],
  ];

  return {
    csv: buildCsvRows(["Metric", "Value"], rows),
    name: "System Overview",
  };
}

// ── PDF generators ────────────────────────────────────────────────────────────

function pdfHeader(doc: PDFKit.PDFDocument, title: string, subtitle?: string) {
  doc.fontSize(20).fillColor("#1a1a1a").text(title, { align: "left" });
  if (subtitle) {
    doc.moveDown(0.3).fontSize(11).fillColor("#6b7280").text(subtitle);
  }
  doc.moveDown(0.8).moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor("#e5e7eb").lineWidth(1).stroke();
  doc.moveDown(0.6);
}

function pdfRow(doc: PDFKit.PDFDocument, cols: string[], widths: number[], isHeader = false) {
  const startX = doc.page.margins.left;
  const y = doc.y;
  doc.fontSize(isHeader ? 9 : 9)
    .fillColor(isHeader ? "#374151" : "#1f2937")
    .font(isHeader ? "Helvetica-Bold" : "Helvetica");

  let x = startX;
  cols.forEach((col, i) => {
    const w = widths[i] ?? 100;
    doc.text(col, x, y, { width: w, ellipsis: true, lineBreak: false });
    x += w;
  });
  doc.moveDown(0.55);
}

function pdfDivider(doc: PDFKit.PDFDocument) {
  doc.moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor("#f3f4f6").lineWidth(0.5).stroke()
    .moveDown(0.3);
}

async function buildMembersPdf(clubId: string, res: Response, reportName: string) {
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  const members = await prisma.clubMembership.findMany({
    where: { clubId, status: MembershipStatus.APPROVED },
    include: { user: { select: { name: true, email: true, department: true, year: true } } },
    orderBy: { createdAt: "asc" },
  });

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${sanitizeFilename(reportName)}.pdf"`);
  doc.pipe(res);

  pdfHeader(doc, `${club?.name ?? "Club"} — Member List`, `Generated ${fmtDate(new Date())} · ${members.length} approved members`);

  const widths = [130, 155, 80, 85, 45];
  pdfRow(doc, ["Name", "Email", "Role", "Department", "Year"], widths, true);
  pdfDivider(doc);

  members.forEach((m, i) => {
    if (doc.y > doc.page.height - 80) doc.addPage();
    if (i % 2 === 0) {
      doc.rect(doc.page.margins.left, doc.y - 2, doc.page.width - doc.page.margins.left - doc.page.margins.right, 16)
        .fillColor("#f9fafb").fill();
      doc.fillColor("#1f2937");
    }
    pdfRow(doc, [
      m.user.name,
      m.user.email,
      m.role,
      m.user.department ?? "—",
      m.user.year ?? "—",
    ], widths);
  });

  doc.end();
}

async function buildAttendancePdf(eventId: string, res: Response, reportName: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { club: { select: { name: true } } },
  });
  const attendees = await prisma.eventAttendance.findMany({
    where: { eventId },
    include: { user: { select: { name: true, email: true, department: true } } },
    orderBy: { createdAt: "asc" },
  });

  const registered  = attendees.filter((a) => a.status === "REGISTERED" && !a.isWaitlisted);
  const waitlisted  = attendees.filter((a) => a.isWaitlisted);
  const checkedIn   = registered.filter((a) => a.checkedIn).length;

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${sanitizeFilename(reportName)}.pdf"`);
  doc.pipe(res);

  pdfHeader(
    doc,
    event?.title ?? "Event Attendance",
    `${event?.club?.name ?? ""} · ${fmtDateTime(event?.startsAt)}`
  );

  doc.fontSize(10).fillColor("#374151")
    .text(`Registered: ${registered.length}   Checked In: ${checkedIn}   Waitlisted: ${waitlisted.length}`, { align: "left" });
  doc.moveDown(0.8);

  const widths = [130, 155, 95, 65, 60];
  pdfRow(doc, ["Name", "Email", "Department", "Status", "Checked In"], widths, true);
  pdfDivider(doc);

  attendees.forEach((a, i) => {
    if (doc.y > doc.page.height - 80) doc.addPage();
    if (i % 2 === 0) {
      doc.rect(doc.page.margins.left, doc.y - 2, doc.page.width - doc.page.margins.left - doc.page.margins.right, 16)
        .fillColor("#f9fafb").fill();
      doc.fillColor("#1f2937");
    }
    pdfRow(doc, [
      a.user.name,
      a.user.email,
      a.user.department ?? "—",
      a.isWaitlisted ? "Waitlisted" : a.status,
      a.checkedIn ? "Yes" : "No",
    ], widths);
  });

  doc.end();
}

async function buildEventsPdf(res: Response, reportName: string) {
  const events = await prisma.event.findMany({
    include: {
      club: { select: { name: true } },
      _count: { select: { attendees: { where: { status: "REGISTERED", isWaitlisted: false } } } },
    },
    orderBy: { startsAt: "desc" },
    take: 300,
  });

  const doc = new PDFDocument({ margin: 50, size: "A4", layout: "landscape" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${sanitizeFilename(reportName)}.pdf"`);
  doc.pipe(res);

  pdfHeader(doc, "All Events Report", `Generated ${fmtDate(new Date())} · ${events.length} events`);

  const widths = [155, 110, 75, 80, 100, 60, 55];
  pdfRow(doc, ["Title", "Club", "Category", "Status", "Starts At", "Registrations", "Capacity"], widths, true);
  pdfDivider(doc);

  events.forEach((e, i) => {
    if (doc.y > doc.page.height - 80) doc.addPage();
    if (i % 2 === 0) {
      doc.rect(doc.page.margins.left, doc.y - 2, doc.page.width - doc.page.margins.left - doc.page.margins.right, 16)
        .fillColor("#f9fafb").fill();
      doc.fillColor("#1f2937");
    }
    pdfRow(doc, [
      e.title,
      e.club.name,
      e.category,
      e.status,
      fmtDateTime(e.startsAt),
      String(e._count.attendees),
      String(e.capacity ?? "—"),
    ], widths);
  });

  doc.end();
}

async function buildSystemPdf(res: Response, reportName: string) {
  const [totalUsers, activeClubs, approvedEvents, totalAttendance, pendingClubs, pendingEvents, feedback] =
    await Promise.all([
      prisma.user.count(),
      prisma.club.count({ where: { status: "ACTIVE" } }),
      prisma.event.count({ where: { status: EventStatus.APPROVED } }),
      prisma.eventAttendance.count({ where: { status: "REGISTERED", isWaitlisted: false } }),
      prisma.club.count({ where: { status: "PENDING" } }),
      prisma.event.count({ where: { status: "PENDING_APPROVAL" } }),
      prisma.eventFeedback.aggregate({ _avg: { rating: true }, _count: { id: true } }),
    ]);

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${sanitizeFilename(reportName)}.pdf"`);
  doc.pipe(res);

  pdfHeader(doc, "System Overview Report", `Generated ${fmtDateTime(new Date())}`);

  const stats = [
    ["Total Users", String(totalUsers)],
    ["Active Clubs", String(activeClubs)],
    ["Pending Club Approvals", String(pendingClubs)],
    ["Approved Events", String(approvedEvents)],
    ["Pending Event Approvals", String(pendingEvents)],
    ["Total Registrations", String(totalAttendance)],
    ["Feedback Submissions", String(feedback._count.id)],
    ["Average Feedback Rating", feedback._avg.rating ? `${Math.round(feedback._avg.rating * 10) / 10} / 5` : "—"],
  ];

  stats.forEach((row, i) => {
    const label = row[0] ?? "";
    const value = row[1] ?? "";
    if (i % 2 === 0) {
      doc.rect(doc.page.margins.left, doc.y - 2, doc.page.width - doc.page.margins.left - doc.page.margins.right, 22)
        .fillColor("#f9fafb").fill();
      doc.fillColor("#1f2937");
    }
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#374151").text(label, doc.page.margins.left, doc.y, { continued: true, width: 250 });
    doc.font("Helvetica").fillColor("#111827").text(value, { align: "left" });
    doc.moveDown(0.4);
  });

  doc.end();
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\- ]/g, "").trim().replace(/ /g, "_");
}

// ── Route handlers ────────────────────────────────────────────────────────────

// UC-10.1 — List past reports
export const listReports: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const reports = await prisma.report.findMany({
    include: { generatedBy: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return res.json(reports);
};

// UC-10.1 — Generate a report: stream file + save metadata
export const generateReport: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const { type, format, clubId, eventId } = req.body as {
    type: string;
    format: string;
    clubId?: string;
    eventId?: string;
  };

  if (!type || !format) {
    return res.status(400).json({ error: "type and format are required" });
  }
  if (!["MEMBERS", "ATTENDANCE", "EVENTS", "SYSTEM"].includes(type)) {
    return res.status(400).json({ error: "Invalid report type" });
  }
  if (!["CSV", "PDF"].includes(format.toUpperCase())) {
    return res.status(400).json({ error: "Invalid format — use CSV or PDF" });
  }

  const fmt = format.toUpperCase() as "CSV" | "PDF";

  // Validate params
  let resolvedClubId: string | undefined;
  let resolvedEventId: string | undefined;

  if (type === "MEMBERS") {
    if (!clubId) return res.status(400).json({ error: "clubId required for MEMBERS report" });
    const club = await resolveClub(clubId);
    if (!club) return res.status(404).json({ error: "Club not found" });
    resolvedClubId = club.id;
  }

  if (type === "ATTENDANCE") {
    if (!eventId) return res.status(400).json({ error: "eventId required for ATTENDANCE report" });
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: "Event not found" });
    resolvedEventId = event.id;
  }

  // Build report name
  let reportName = "";
  if (type === "MEMBERS" && resolvedClubId) {
    const club = await prisma.club.findUnique({ where: { id: resolvedClubId } });
    reportName = `${club?.name ?? "Club"} Members`;
  } else if (type === "ATTENDANCE" && resolvedEventId) {
    const event = await prisma.event.findUnique({ where: { id: resolvedEventId } });
    reportName = `${event?.title ?? "Event"} Attendance`;
  } else if (type === "EVENTS") {
    reportName = "All Events";
  } else {
    reportName = "System Overview";
  }

  // Save metadata
  await prisma.report.create({
    data: {
      type,
      format: fmt,
      name: reportName,
      params: { clubId: resolvedClubId ?? null, eventId: resolvedEventId ?? null },
      generatedById: req.user.id,
    },
  });

  // Stream response
  if (fmt === "CSV") {
    let csv = "";
    let filename = sanitizeFilename(reportName);

    if (type === "MEMBERS" && resolvedClubId) {
      const r = await buildMembersCsv(resolvedClubId);
      csv = r.csv;
      filename = sanitizeFilename(r.name);
    } else if (type === "ATTENDANCE" && resolvedEventId) {
      const r = await buildAttendanceCsv(resolvedEventId);
      csv = r.csv;
      filename = sanitizeFilename(r.name);
    } else if (type === "EVENTS") {
      const r = await buildEventsCsv();
      csv = r.csv;
      filename = sanitizeFilename(r.name);
    } else {
      const r = await buildSystemCsv();
      csv = r.csv;
      filename = sanitizeFilename(r.name);
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    return res.send(csv);
  }

  // PDF
  if (type === "MEMBERS" && resolvedClubId) {
    await buildMembersPdf(resolvedClubId, res, reportName);
  } else if (type === "ATTENDANCE" && resolvedEventId) {
    await buildAttendancePdf(resolvedEventId, res, reportName);
  } else if (type === "EVENTS") {
    await buildEventsPdf(res, reportName);
  } else {
    await buildSystemPdf(res, reportName);
  }
};

// UC-10.2 — Re-download a past report by regenerating
export const downloadReport: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const id = req.params["id"] as string;
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return res.status(404).json({ error: "Report not found" });

  const params = report.params as { clubId?: string | null; eventId?: string | null };
  const fmt = report.format as "CSV" | "PDF";

  if (fmt === "CSV") {
    let csv = "";
    const filename = sanitizeFilename(report.name);

    if (report.type === "MEMBERS" && params.clubId) {
      const r = await buildMembersCsv(params.clubId);
      csv = r.csv;
    } else if (report.type === "ATTENDANCE" && params.eventId) {
      const r = await buildAttendanceCsv(params.eventId);
      csv = r.csv;
    } else if (report.type === "EVENTS") {
      const r = await buildEventsCsv();
      csv = r.csv;
    } else {
      const r = await buildSystemCsv();
      csv = r.csv;
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    return res.send(csv);
  }

  // PDF
  if (report.type === "MEMBERS" && params.clubId) {
    await buildMembersPdf(params.clubId, res, report.name);
  } else if (report.type === "ATTENDANCE" && params.eventId) {
    await buildAttendancePdf(params.eventId, res, report.name);
  } else if (report.type === "EVENTS") {
    await buildEventsPdf(res, report.name);
  } else {
    await buildSystemPdf(res, report.name);
  }
};

// U5.8 — Digital Attendance Certificate
export const generateCertificate: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const { eventId, userId } = req.body as { eventId?: string; userId?: string };
  if (!eventId || !userId) return res.status(400).json({ error: "eventId and userId are required" });

  if (req.user.id !== userId) {
    const isAdmin = (req.user.role === "UNIVERSITY_ADMIN" || req.user.role === "SYSTEM_ADMIN");
    if (!isAdmin) return res.status(403).json({ error: "You can only download your own certificate" });
  }

  const attendance = await prisma.eventAttendance.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  if (!attendance || !attendance.checkedIn) {
    return res.status(403).json({ error: "Certificate only available after check-in" });
  }

  const [event, user] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      include: { club: { select: { name: true } } },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);

  if (!event || !user) return res.status(404).json({ error: "Event or user not found" });

  const doc = new PDFDocument({ margin: 72, size: "A4", layout: "landscape" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="Certificate_${sanitizeFilename(event.title)}.pdf"`);
  doc.pipe(res);

  const W = doc.page.width;
  const H = doc.page.height;
  const m = 72;

  // Background
  doc.rect(0, 0, W, H).fillColor("#fffbf0").fill();

  // Top amber bar
  doc.rect(0, 0, W, 12).fillColor("#EBA814").fill();
  // Bottom amber bar
  doc.rect(0, H - 12, W, 12).fillColor("#EBA814").fill();

  // Corner decorations
  doc.rect(m - 10, m - 10, 30, 4).fillColor("#EBA814").fill();
  doc.rect(m - 10, m - 10, 4, 30).fillColor("#EBA814").fill();
  doc.rect(W - m - 20, m - 10, 30, 4).fillColor("#EBA814").fill();
  doc.rect(W - m + 6, m - 10, 4, 30).fillColor("#EBA814").fill();
  doc.rect(m - 10, H - m + 6, 30, 4).fillColor("#EBA814").fill();
  doc.rect(m - 10, H - m - 20, 4, 30).fillColor("#EBA814").fill();
  doc.rect(W - m - 20, H - m + 6, 30, 4).fillColor("#EBA814").fill();
  doc.rect(W - m + 6, H - m - 20, 4, 30).fillColor("#EBA814").fill();

  // Platform name
  doc.fontSize(11).fillColor("#EBA814").font("Helvetica-Bold")
    .text("CLUB CONNECT", m, m + 10, { align: "center", width: W - 2 * m });

  // Certificate of Attendance header
  doc.moveDown(0.5)
    .fontSize(32).fillColor("#1a1a1a").font("Helvetica-Bold")
    .text("Certificate of Attendance", m, doc.y, { align: "center", width: W - 2 * m });

  // Decorative line
  const lineY = doc.y + 10;
  doc.moveTo(W / 2 - 100, lineY).lineTo(W / 2 + 100, lineY).strokeColor("#EBA814").lineWidth(2).stroke();
  doc.y = lineY + 20;

  // This certifies text
  doc.fontSize(13).fillColor("#6b7280").font("Helvetica")
    .text("This certifies that", m, doc.y, { align: "center", width: W - 2 * m });

  // Student name
  doc.moveDown(0.6).fontSize(30).fillColor("#EBA814").font("Helvetica-Bold")
    .text(user.name, m, doc.y, { align: "center", width: W - 2 * m });

  // Attended text
  doc.moveDown(0.4).fontSize(13).fillColor("#6b7280").font("Helvetica")
    .text("successfully attended", m, doc.y, { align: "center", width: W - 2 * m });

  // Event name
  doc.moveDown(0.4).fontSize(20).fillColor("#1a1a1a").font("Helvetica-Bold")
    .text(event.title, m, doc.y, { align: "center", width: W - 2 * m });

  // Organised by + date
  doc.moveDown(0.4).fontSize(12).fillColor("#6b7280").font("Helvetica")
    .text(`Organised by ${event.club.name}  ·  ${fmtDate(event.startsAt)}`, m, doc.y, { align: "center", width: W - 2 * m });

  // Signature area
  const sigY = H - m - 60;
  doc.moveTo(m + 30, sigY).lineTo(m + 180, sigY).strokeColor("#d1d5db").lineWidth(1).stroke();
  doc.fontSize(10).fillColor("#374151").font("Helvetica")
    .text("Club Connect Platform", m + 30, sigY + 6, { width: 180, align: "center" });

  doc.end();
};

// Delete a report record
export const deleteReport: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const id = req.params["id"] as string;
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return res.status(404).json({ error: "Report not found" });

  await prisma.report.delete({ where: { id } });
  return res.json({ message: "Report deleted" });
};
