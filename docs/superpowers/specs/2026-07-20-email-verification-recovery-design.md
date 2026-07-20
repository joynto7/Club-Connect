# Email verification recovery — design

## Context

Club Connect enforces email verification at login (`backend/src/controllers/authController.ts:267-269`) — this session re-enabled it by flipping `SKIP_EMAIL_VERIFICATION` from `"true"` to `"false"` in `backend/.env` (local-only, gitignored; does not affect the deployed Render environment, which manages its own env vars separately). Registration only validates email *format* (`z.string().email()`, `authController.ts:21`) — a syntactically valid but unreachable/mistyped address (e.g. `asdf1234@nonexistent-domain.com`) is accepted, and that account can never receive its verification link.

Today there is no recovery path for that account:
- `resendVerification` (`authController.ts:197`) only re-sends to the *same* on-file address — no help if that address is wrong.
- Admin routes (`backend/src/routes/admin.ts:44-73`) only expose suspend/activate/role-change — nothing writes `emailVerified` or `email` for another user.
- The frontend login page (`frontend/src/app/login/page.tsx`) shows the raw "please verify your email" error with zero follow-up UI — no resend button, no way to fix the email. (`resend-verification` already exists on the backend but is currently unreachable from any frontend page.)

## Goals

- Let a user whose own account is stuck unverified (wrong email at registration, or just never received/lost the link) fix it themselves, without an admin.
- Wire the login page's existing dead-end error state to two actions: resend to the same address, or correct the address and get a fresh link.

## Non-goals

- **Admin-side override** (manually mark a user verified, or edit another user's email on their behalf) — considered, explicitly not requested; user chose self-service only.
- **Changing email for an already-verified/active account** — out of scope; this only applies to accounts where `emailVerified` is still `false`. A verified user changing their email is a different feature (would need re-verification of an active account, session implications, etc.) not addressed here.
- **A structured error-code response contract** — the frontend detects the "unverified" case by matching the exact existing error string, consistent with how this codebase already returns plain `{error: string}` everywhere (no existing precedent for structured error codes to extend).
- **Production `.env` update** — flipping `SKIP_EMAIL_VERIFICATION` was done locally only (`backend/.env`, gitignored). If Render's deployed environment also has this flag set to skip verification, this doc doesn't cover updating it — that's a separate, manual step in Render's dashboard.

## Backend changes

New endpoint `POST /auth/change-unverified-email` (`backend/src/routes/auth.ts`, `backend/src/controllers/authController.ts`), rate-limited with the existing `strictLimiter` (same tier as `/auth/login` — this is a password-guessing surface, unlike the password-less `resendVerification`).

Request: `{ email: string, password: string, newEmail: string }` (Zod: all three `z.string().email()`/`.min(8)` as appropriate, matching `registerSchema`'s existing shape).

Handler logic, in order:
1. Look up user by `email` (the *current* on-file address). Not found → `401 { error: "Invalid email or password" }` (exact wording `login` already uses for the same ambiguity).
2. `bcrypt.compare(password, user.password)` — mismatch → same `401` as step 1.
3. `user.emailVerified === true` → `400 { error: "This account is already verified. Please log in." }`.
4. If `newEmail !== user.email`: check `prisma.user.findUnique({ where: { email: newEmail } })` — found → `409 { error: "Email is already registered" }` (exact wording `register` already uses). If `newEmail === user.email`, skip this check — resending to the same address is a valid, harmless no-op.
5. Generate a new token + 24h expiry via the existing `createRandomToken()` pattern, `prisma.user.update` to set `email: newEmail` plus the new token/expiry, then `sendEmail()` to `newEmail` using the exact same subject/body template `register`/`resendVerification` already send.
6. `200 { message: "Email updated. Please check your new inbox to verify your account." }`.

## Frontend changes

**`frontend/src/lib/auth.ts`:** two new thin functions, matching `requestPasswordReset`/`resetPassword`'s existing shape exactly:
- `resendVerification({ email }) → POST /auth/resend-verification`
- `changeUnverifiedEmail({ email, password, newEmail }) → POST /auth/change-unverified-email`

**`frontend/src/app/login/page.tsx`:** a local constant `EMAIL_NOT_VERIFIED_MESSAGE = "Please verify your email before logging in."` (mirrors the backend string by hand — no shared package between the two apps, same constraint already documented in this repo's earlier admin-dashboard-split spec). When `apiError === EMAIL_NOT_VERIFIED_MESSAGE`, render an inline block below the existing error banner with two actions:
- **"Resend verification email"** button — calls `resendVerification({ email: getValues("email") })` (pulls the address already typed into the form; no new input). Result shown via the existing `toast` pattern.
- **"Wrong email? Change it"** toggle — expands one new `<input type="email">` for the corrected address. Submits `changeUnverifiedEmail({ email: getValues("email"), password: getValues("password"), newEmail })` — reuses the password already typed into the login form, so the user never re-types it. On success: toast the returned message, collapse the block, clear `apiError` (nothing more to do on this page until they click the new link).

No new shared component — this is a small, page-local addition using the `useMutation`/`toast`/`getApiErrorMessage` pattern already used twice on this same page.

## Error handling

Every response reuses wording and status codes this codebase already returns elsewhere for the same *kind* of fact: `401` generic-credentials (matches `login`), `409` email-taken (matches `register`), `400` already-verified (new wording, but same status class as other precondition failures on this page, e.g. 2FA-not-configured). No new leak surface: a correct email+password combo already grants full account control via the normal login path regardless of this endpoint.

## Verification

No test framework in this repo (confirmed: no Jest/Vitest, no `test` script in either `package.json`) — consistent with every other change in this project so far. Manual verification:
- Register with a throwaway/unreachable email; confirm login blocks with the new inline UI (not just a bare error).
- Click "Resend verification email"; confirm the existing endpoint responds (this path already worked server-side, only the button was missing).
- Use "Wrong email? Change it" with a corrected address; confirm the new address receives a working verification link, and that login succeeds once clicked.
- Confirm attempting to change to an email already used by a different account returns the "already registered" error instead of silently succeeding.
