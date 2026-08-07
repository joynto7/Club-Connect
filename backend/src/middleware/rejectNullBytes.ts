import type { RequestHandler } from "express";

// Postgres rejects raw 0x00 bytes in text columns outright ("invalid byte
// sequence for encoding UTF8"), and Zod's z.string() doesn't reject them —
// so a null byte anywhere in a body field or URL reached the DB driver
// unvalidated and surfaced as an unhandled 500 instead of a clean 400.
const NULL_BYTE = String.fromCharCode(0);

function containsNullByte(value: unknown): boolean {
  if (typeof value === "string") return value.includes(NULL_BYTE);
  if (Array.isArray(value)) return value.some(containsNullByte);
  if (value && typeof value === "object") return Object.values(value).some(containsNullByte);
  return false;
}

export const rejectNullBytes: RequestHandler = (req, res, next) => {
  if (req.url.includes("%00") || containsNullByte(req.body)) {
    return res.status(400).json({ error: "Invalid input: null bytes are not allowed" });
  }
  next();
};
