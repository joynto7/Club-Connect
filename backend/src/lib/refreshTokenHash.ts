import crypto from "crypto";

// bcrypt silently truncates its input at 72 bytes. Refresh tokens are JWTs, and
// every token issued to the same user shares an identical header + userId/email
// prefix far longer than 72 bytes — so bcrypt.compare was validating only that
// shared prefix, making every refresh token ever issued to a user valid forever
// regardless of rotation. Refresh tokens are already high-entropy (HMAC-signed),
// unlike passwords, so a full-length SHA-256 digest is the correct tool here.
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function verifyRefreshToken(token: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashRefreshToken(token));
  const stored = Buffer.from(storedHash);
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
}
