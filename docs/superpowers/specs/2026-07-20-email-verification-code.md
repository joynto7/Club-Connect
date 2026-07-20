# Email verification via 6-digit code — design

## Context

Club Connect verifies email addresses today via a clickable link: `register`/`resendVerification`/`changeUnverifiedEmail` (`backend/src/controllers/authController.ts`) each generate a 48-char hex token (`createRandomToken()`), store it in `User.emailVerificationToken`/`emailVerificationTokenExpires` (24h expiry), and email a link (`${frontendUrl}/verify-email?token=...`). `GET /auth/verify-email` (`routes/auth.ts`) looks the token up directly (it's unique/unguessable enough to search on alone) and sets `emailVerified: true`. The frontend's `VerifyEmail.tsx` (`frontend/src/components/auth/VerifyEmail.tsx`) reads the token from the URL and calls that endpoint automatically on page load.

The user wants this replaced with a 6-digit numeric code the user types in, rather than a link they click — reusing the same code-entry interaction pattern already built for 2FA (`verify2FA`, the numeric-input UI on the login page).

## Goals

- Registration, resend, and email-change all send a 6-digit numeric code instead of a link.
- A dedicated page lets the user enter their email + code to verify, reachable after registering, from the login page's existing "unverified" block, or by returning later.
- Brute-forcing the code is impractical: short expiry + existing rate-limit tier, not a 24-hour window.

## Non-goals

- **Password reset** (`requestPasswordReset`/`resetPassword`) — stays link-based, untouched. Different feature, not what was asked.
- **A new per-account wrong-attempt lockout** — considered (see spec discussion below), explicitly declined in favor of the simpler short-expiry + rate-limit approach. `loginAttempts`/`lockedUntil` are login's own counter and are not reused here — a wrong verification code must not lock someone out of logging in.
- **Backward compatibility with the old `?token=` link shape** — this app has no user base relying on old emailed links; the switch is a clean cutover, not a dual-support period.

## Backend changes (`backend/src/controllers/authController.ts`, `backend/src/routes/auth.ts`)

- New `createVerificationCode()`: `crypto.randomInt(100000, 1000000).toString()` — always exactly 6 digits (the range excludes anything that would need leading-zero padding). Separate from the existing `createRandomToken()`, which `requestPasswordReset` keeps using unchanged.
- `emailVerificationSchema` changes from `z.object({ token: z.string().min(10) })` (validated `req.query`) to `z.object({ email: z.string().email(), code: z.string().length(6) })` (validated `req.body`).
- `register`, `resendVerification`, `changeUnverifiedEmail`: replace `createRandomToken()` with `createVerificationCode()` for the email-verification purpose specifically (password-reset's own `createRandomToken()` call in `requestPasswordReset` is untouched), and shorten `emailVerificationTokenExpires` from `Date.now() + 1000 * 60 * 60 * 24` (24h) to `Date.now() + 1000 * 60 * 15` (15 min) in all three places. Each stops building a `verifyUrl` and instead emails the code as plain text (e.g. "Your verification code is: 123456. It expires in 15 minutes.").
- `verifyEmail` moves from `GET` to `POST`, reads `{email, code}` from the body instead of `token` from the query, looks up `prisma.user.findUnique({where: {email}})` (a 6-digit code isn't unique enough to search on directly the way the old 48-char token was), then checks `user.emailVerificationToken === code && user.emailVerificationTokenExpires > now`. Any mismatch (wrong email, wrong code, expired) returns one generic `400 {"error": "Invalid or expired code"}` — doesn't reveal which part failed.
- `routes/auth.ts`: `router.get("/verify-email", verifyEmail)` becomes `router.post("/verify-email", strictLimiter, verifyEmail)` — moves onto the same rate-limit tier `login`/`change-unverified-email` use, since it's now a guessable-secret-checking endpoint rather than a lookup-by-unique-token endpoint.

## Frontend changes

- **`frontend/src/components/auth/VerifyEmail.tsx`** — full rewrite. Two inputs: email (pre-filled from a `?email=` query param when present, still editable) and a 6-digit code (same numeric-input styling as the existing 2FA code box on the login page: `inputMode="numeric" pattern="[0-9]*" maxLength={6}`, centered large text). Submits `POST /auth/verify-email`. Success → redirect to `/login` with a success toast. Also includes a "Resend code" action calling the already-existing `resendVerification()` (`frontend/src/lib/auth.ts`, built earlier this session) — without it, a user whose code expires or gets mistyped on this page would have to navigate away (to the login page's own resend button) just to get a fresh one. Also rewritten to match the branded look the rest of auth (`login`/`register`) already uses (`#EBA814` gold, the same card/layout conventions) instead of its current, inconsistent generic `surface-*`/`text-danger` token styling — since the whole component body is being replaced anyway, matching the page a user just came from (register) is a small, in-scope improvement, not unrelated refactoring.
- **`frontend/src/app/register/page.tsx`** — on successful registration, redirect to `/verify-email?email=<their email>` instead of showing a static green success message and stopping. Without this there'd be no way to reach the code-entry screen.
- **`frontend/src/app/login/page.tsx`** — the existing amber "unverified" block (built earlier this session) gains a third action, "Enter verification code," linking to `/verify-email?email=<the email currently in the form>`, alongside the existing resend/change-email actions.

## Error handling

Same anti-enumeration posture as the rest of this session's work: generic messages, no signal about whether an email exists or how close a wrong code was. Rate limiting via the existing `strictLimiter` (10 requests/15 min per IP) bounds brute-force attempts against a 900,000-value code space to a negligible success chance within the 15-minute expiry.

## Verification

No test framework in this repo (unchanged project convention). Manual:
- Register a new account → confirm redirect to `/verify-email?email=...` with the email pre-filled.
- Submit a wrong code → generic error, no hint.
- Submit the correct code (read from the backend's console-dump fallback locally, since production SMTP delivery to test domains is unreliable per this session's earlier findings) → verifies, redirects to `/login`.
- Confirm the *old* code no longer works after clicking "resend" (a fresh one replaces it).
- Log in before verifying → confirm the amber block's new "Enter verification code" link lands on `/verify-email` with the email pre-filled.
- Confirm no remaining code path builds a `?token=` verification link anywhere (`grep -rn "verify-email?token" frontend backend` should return nothing).
