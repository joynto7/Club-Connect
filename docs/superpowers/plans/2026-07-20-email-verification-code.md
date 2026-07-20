# Email Verification Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace email verification's clickable link with a 6-digit code the user types in, with a dedicated page to enter it.

**Architecture:** A new `createVerificationCode()` (6-digit numeric) replaces `createRandomToken()` wherever *email verification* generates a token — `register`, `resendVerification`, `changeUnverifiedEmail` — reusing the same `User.emailVerificationToken`/`emailVerificationTokenExpires` fields (no schema change), just with a shorter value and a 15-minute expiry instead of 24 hours. `verifyEmail` moves from `GET ?token=` to `POST {email, code}` since a 6-digit value isn't unique enough to look up alone. The frontend gets one rewritten component (`VerifyEmail.tsx`) plus two small call-site changes (register redirects there, login's existing "unverified" block links there).

**Tech Stack:** Express + Prisma + Zod (backend, all already dependencies — `crypto.randomInt` is Node built-in), Next.js + React Hook Form + TanStack Query + sonner (frontend, all already dependencies). No test framework exists in this repo — verification is `tsc --noEmit` plus manual checks.

**Full design context:** `docs/superpowers/specs/2026-07-20-email-verification-code.md` — read it if anything below is unclear on *why*, not just *what*.

## Global Constraints

- TypeScript everywhere; both apps must pass `npx tsc --noEmit` after every task.
- No new npm dependencies.
- No test framework — do not add Jest/Vitest/etc. Verify with `tsc --noEmit` and the manual steps in each task.
- Password reset (`requestPasswordReset`, `resetPassword`, and `createRandomToken()` itself) is untouched — it stays link-based. `createVerificationCode()` is a new, separate function used only for email verification.
- Every email-verification token generation (`register`, `resendVerification`, `changeUnverifiedEmail`) uses a 15-minute expiry (`Date.now() + 1000 * 60 * 15`), not the old 24-hour one.
- `verifyEmail` moves to `POST`, behind the existing `strictLimiter` (same tier as `login`/`change-unverified-email`) — it's now a guessable-secret-checking endpoint.
- Wrong email, wrong code, and expired code all return the same generic `400 {"error": "Invalid or expired code"}` — never reveal which one failed.
- The rewritten `VerifyEmail.tsx` matches the `#EBA814`-branded look `login`/`register` already use, not its current generic `surface-*`/`text-danger` token styling.

---

### Task 1: Backend — code-based verification

**Files:**
- Modify: `backend/src/controllers/authController.ts`
- Modify: `backend/src/routes/auth.ts`

**Interfaces:**
- Produces: `createVerificationCode(): string` (6-digit numeric string), a new `emailVerificationSchema` shape (`{email, code}` instead of `{token}`), and `verifyEmail` now expecting a POST body instead of a GET query — all internal to `authController.ts`/`routes/auth.ts`. Task 2 (frontend) calls `POST /auth/verify-email` with `{email: string, code: string}`, expecting `200 {message: string}` on success or `400 {error: "Invalid or expired code"}` on failure — no other task consumes anything from this one directly.

- [ ] **Step 1: Change the verification schema**

In `backend/src/controllers/authController.ts`, find:

```ts
const emailVerificationSchema = z.object({
  token: z.string().min(10),
});
```

Replace with:

```ts
const emailVerificationSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});
```

- [ ] **Step 2: Add the code generator, next to `createRandomToken`**

Find:

```ts
const createRandomToken = () => crypto.randomBytes(24).toString("hex");
```

Replace with:

```ts
const createRandomToken = () => crypto.randomBytes(24).toString("hex");

// 6-digit numeric code for email verification specifically — createRandomToken()
// (above) stays in use for password reset, which is unaffected by this change.
const createVerificationCode = () => crypto.randomInt(100000, 1000000).toString();
```

- [ ] **Step 3: Switch `register` to the code, 15-min expiry, code-only email**

Find:

```ts
  const passwordHash = await bcrypt.hash(password, 10);
  const emailVerificationToken = createRandomToken();
  const emailVerificationTokenExpires = new Date(Date.now() + 1000 * 60 * 60 * 24);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: passwordHash,
      department:  department  ?? null,
      year:        year        ?? null,
      emailVerificationToken,
      emailVerificationTokenExpires,
      emailVerified: skipEmailVerification,
    },
  });

  const verifyUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(emailVerificationToken)}`;
  void sendEmail(
    email,
    "Verify your Club Connect email",
    `<p>Hi ${name},</p><p>Click the link below to verify your email address:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`
  );
```

Replace with:

```ts
  const passwordHash = await bcrypt.hash(password, 10);
  const emailVerificationToken = createVerificationCode();
  const emailVerificationTokenExpires = new Date(Date.now() + 1000 * 60 * 15);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: passwordHash,
      department:  department  ?? null,
      year:        year        ?? null,
      emailVerificationToken,
      emailVerificationTokenExpires,
      emailVerified: skipEmailVerification,
    },
  });

  void sendEmail(
    email,
    "Verify your Club Connect email",
    `<p>Hi ${name},</p><p>Your verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${emailVerificationToken}</p><p>This code expires in 15 minutes.</p>`
  );
```

(`frontendUrl` is still used elsewhere in this file — e.g. password reset's `resetUrl` — so its declaration at the top of the file stays; only this function's own `verifyUrl` line is removed.)

- [ ] **Step 4: Rewrite `verifyEmail` for email+code**

Find:

```ts
export const verifyEmail: RequestHandler = async (req, res) => {
  const parseResult = emailVerificationSchema.safeParse(req.query);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid verification token" });
  }

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: parseResult.data.token,
      emailVerificationTokenExpires: {
        gte: new Date(),
      },
    },
  });

  if (!user) {
    return res.status(400).json({ error: "Verification token is invalid or expired" });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationTokenExpires: null,
    },
  });

  return res.json({ message: "Email verified successfully. You can now log in." });
};
```

Replace with:

```ts
export const verifyEmail: RequestHandler = async (req, res) => {
  const parseResult = emailVerificationSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid or expired code" });
  }

  const { email, code } = parseResult.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (
    !user ||
    user.emailVerificationToken !== code ||
    !user.emailVerificationTokenExpires ||
    user.emailVerificationTokenExpires < new Date()
  ) {
    return res.status(400).json({ error: "Invalid or expired code" });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationTokenExpires: null,
    },
  });

  return res.json({ message: "Email verified successfully. You can now log in." });
};
```

- [ ] **Step 5: Switch `resendVerification` to the code, 15-min expiry, code-only email**

Find:

```ts
  const emailVerificationToken = createRandomToken();
  const emailVerificationTokenExpires = new Date(Date.now() + 1000 * 60 * 60 * 24);

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerificationToken, emailVerificationTokenExpires },
  });

  const verifyUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(emailVerificationToken)}`;
  void sendEmail(
    user.email,
    "Verify your Club Connect email",
    `<p>Hi ${user.name},</p><p>Click the link below to verify your email address:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`
  );

  return res.json({ message: "If the email is registered and unverified, a new verification link has been sent." });
};

// Lets a stuck-unverified user (wrong/unreachable email at registration) fix it
```

Replace with:

```ts
  const emailVerificationToken = createVerificationCode();
  const emailVerificationTokenExpires = new Date(Date.now() + 1000 * 60 * 15);

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerificationToken, emailVerificationTokenExpires },
  });

  void sendEmail(
    user.email,
    "Verify your Club Connect email",
    `<p>Hi ${user.name},</p><p>Your verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${emailVerificationToken}</p><p>This code expires in 15 minutes.</p>`
  );

  return res.json({ message: "If the email is registered and unverified, a new verification code has been sent." });
};

// Lets a stuck-unverified user (wrong/unreachable email at registration) fix it
```

(Note the two `return res.json(...)` calls in `resendVerification` — the early-return at the top of the function, `if (!user || user.emailVerified) { return res.json({ message: "If the email is registered and unverified, a new verification code has been sent." }); }`, must ALSO change its wording from "link" to "code" for consistency. Find that line separately:)

Find:

```ts
  // Always return 200 to avoid leaking which emails are registered
  const user = await prisma.user.findUnique({ where: { email: parseResult.data.email } });
  if (!user || user.emailVerified) {
    return res.json({ message: "If the email is registered and unverified, a new verification link has been sent." });
  }
```

Replace with:

```ts
  // Always return 200 to avoid leaking which emails are registered
  const user = await prisma.user.findUnique({ where: { email: parseResult.data.email } });
  if (!user || user.emailVerified) {
    return res.json({ message: "If the email is registered and unverified, a new verification code has been sent." });
  }
```

- [ ] **Step 6: Switch `changeUnverifiedEmail` to the code, 15-min expiry, code-only email**

Find:

```ts
  const emailVerificationToken = createRandomToken();
  const emailVerificationTokenExpires = new Date(Date.now() + 1000 * 60 * 60 * 24);

  await prisma.user.update({
    where: { id: user.id },
    data: { email: newEmail, emailVerificationToken, emailVerificationTokenExpires },
  });

  const verifyUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(emailVerificationToken)}`;
  void sendEmail(
    newEmail,
    "Verify your Club Connect email",
    `<p>Hi ${user.name},</p><p>Click the link below to verify your email address:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`
  );

  return res.json({ message: "Email updated. Please check your new inbox to verify your account." });
};
```

Replace with:

```ts
  const emailVerificationToken = createVerificationCode();
  const emailVerificationTokenExpires = new Date(Date.now() + 1000 * 60 * 15);

  await prisma.user.update({
    where: { id: user.id },
    data: { email: newEmail, emailVerificationToken, emailVerificationTokenExpires },
  });

  void sendEmail(
    newEmail,
    "Verify your Club Connect email",
    `<p>Hi ${user.name},</p><p>Your verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${emailVerificationToken}</p><p>This code expires in 15 minutes.</p>`
  );

  return res.json({ message: "Email updated. Please check your new inbox to verify your account." });
};
```

- [ ] **Step 7: Move the route to POST with `strictLimiter`**

In `backend/src/routes/auth.ts`, find:

```ts
router.get("/verify-email", verifyEmail);
```

Replace with:

```ts
router.post("/verify-email", strictLimiter, verifyEmail);
```

- [ ] **Step 8: Type-check the backend**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors. If you see an unused-variable-style complaint about `verifyUrl`, you missed removing one of the three `const verifyUrl = ...` lines in Step 3/5/6 — `grep -n "verifyUrl" backend/src/controllers/authController.ts` should now show zero matches (password reset uses a *different* variable name, `resetUrl`, which stays).

- [ ] **Step 9: Manual verification — exercise every branch**

Start the backend locally: `cd backend && npm run dev`. `backend/.env` has real SMTP credentials configured, so `sendEmail` will attempt a real send rather than falling back to the console dump — and it never logs the code itself either way (the success path logs nothing; the failure path's `logger.error` call only includes `{to, subject, error}`, not the email body). So don't rely on the log. Instead, read the generated code straight from the database with a one-off script (same technique used earlier this session for a similar "confirm hidden server-side state" check):

```bash
curl -s -X POST http://127.0.0.1:5001/auth/register -H "Content-Type: application/json" \
  -d '{"name":"Code Test","email":"code-verify-test@example.com","password":"testpass123"}'
```

Expected: `201`.

```bash
cd backend && npx ts-node-esm -e "
import prisma from './src/prisma.ts';
const u = await prisma.user.findUnique({ where: { email: 'code-verify-test@example.com' } });
console.log('code:', u?.emailVerificationToken, 'expires:', u?.emailVerificationTokenExpires);
"
```

Expected: prints a 6-digit `code:` value and an `expires:` timestamp ~15 minutes out. Use that code in the steps below.

```bash
# Wrong code -> generic error
curl -s -X POST http://127.0.0.1:5001/auth/verify-email -H "Content-Type: application/json" \
  -d '{"email":"code-verify-test@example.com","code":"000000"}'
```

Expected: `{"error":"Invalid or expired code"}` (unless `000000` happens to be the real generated code — vanishingly unlikely, but if it happens, register a second test user and retry).

```bash
# Correct code -> success
curl -s -X POST http://127.0.0.1:5001/auth/verify-email -H "Content-Type: application/json" \
  -d '{"email":"code-verify-test@example.com","code":"<the real code from the log>"}'
```

Expected: `{"message":"Email verified successfully. You can now log in."}`

```bash
# Re-using the same code again -> now invalid (already cleared)
curl -s -X POST http://127.0.0.1:5001/auth/verify-email -H "Content-Type: application/json" \
  -d '{"email":"code-verify-test@example.com","code":"<the same code again>"}'
```

Expected: `{"error":"Invalid or expired code"}` (token was nulled out on successful verify).

- [ ] **Step 10: Commit**

```bash
cd "/Users/joyntoghosh/Club Connect"
git add backend/src/controllers/authController.ts backend/src/routes/auth.ts
git commit -m "$(cat <<'EOF'
Switch email verification from a link to a 6-digit code

register/resendVerification/changeUnverifiedEmail now generate a
6-digit numeric code (createVerificationCode) instead of a 48-char
hex token, with a 15-minute expiry instead of 24 hours — reusing the
existing emailVerificationToken/emailVerificationTokenExpires fields,
just storing a shorter value. verifyEmail moves from GET ?token= to
POST {email, code}, since a 6-digit value isn't unique enough to look
up alone, and picks up strictLimiter as a guessable-secret endpoint.
Password reset (createRandomToken, requestPasswordReset/resetPassword)
is untouched — it keeps its own link-based flow.
EOF
)"
```

---

### Task 2: Frontend — code-entry page and its two entry points

**Files:**
- Modify: `frontend/src/components/auth/VerifyEmail.tsx`
- Modify: `frontend/src/app/register/page.tsx`
- Modify: `frontend/src/app/login/page.tsx`

**Interfaces:**
- Consumes: `POST /auth/verify-email` with `{email, code}` (Task 1) → `200 {message}` or `400 {error}`. Also consumes the already-existing `resendVerification({email})` from `frontend/src/lib/auth.ts` (built earlier this session, unchanged by this plan).
- Produces: nothing consumed by anything later — this is the last task.

- [ ] **Step 1: Rewrite `VerifyEmail.tsx`**

Replace the full contents of `frontend/src/components/auth/VerifyEmail.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/axios";
import { getApiErrorMessage, resendVerification } from "@/lib/auth";
import LogoIcon from "@/components/shared/LogoIcon";

export default function VerifyEmail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");

  const verifyMutation = useMutation({
    mutationFn: () => api.post<{ message: string }>("/auth/verify-email", { email, code }).then((r) => r.data),
    onSuccess(data) {
      toast.success(data.message);
      router.push("/login");
    },
    onError(error) {
      toast.error(getApiErrorMessage(error));
    },
  });

  const resendMutation = useMutation({
    mutationFn: resendVerification,
    onSuccess(data) {
      toast.success(data.message);
    },
    onError(error) {
      toast.error(getApiErrorMessage(error));
    },
  });

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4 sm:p-8 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-100 p-8 sm:p-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl shadow-sm overflow-hidden mb-3">
            <LogoIcon size={56} />
          </div>
          <h1 className="text-lg font-bold text-gray-900 tracking-wide">
            CLUB <span className="text-[#EBA814]">CONNECT</span>
          </h1>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-1 text-center">
          Verify <span className="text-[#EBA814]">Your Email</span>
        </h2>
        <p className="text-gray-500 mb-8 text-sm text-center font-medium">
          Enter the 6-digit code we sent to your email address.
        </p>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm outline-none transition-colors focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814]"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Verification Code</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="w-full text-center text-2xl tracking-[0.5em] font-mono border-2 border-gray-200 rounded-xl py-3 bg-white text-gray-900 focus:outline-none focus:border-[#EBA814]"
            />
          </div>

          <button
            type="button"
            onClick={() => verifyMutation.mutate()}
            disabled={verifyMutation.isPending || code.length !== 6 || !email}
            className="w-full py-3.5 bg-[#EBA814] hover:bg-[#D99810] text-white font-semibold rounded-xl transition-all shadow-[0_6px_20px_rgba(235,168,20,0.3)] disabled:opacity-70"
          >
            {verifyMutation.isPending ? "Verifying…" : "Verify Email"}
          </button>

          <button
            type="button"
            onClick={() => resendMutation.mutate({ email })}
            disabled={resendMutation.isPending || !email}
            className="w-full text-sm font-semibold text-[#EBA814] hover:underline disabled:opacity-60"
          >
            {resendMutation.isPending ? "Sending…" : "Resend code"}
          </button>
        </div>

        <p className="text-center mt-8 text-sm font-medium text-gray-500">
          Already verified? <Link href="/login" className="text-[#EBA814] font-bold hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
}
```

This calls `POST /auth/verify-email` directly via the shared `api` client (matching the request/response shape Task 1 produces) rather than adding a dedicated `lib/auth.ts` wrapper — it's the only caller, so a one-line inline call is simpler than a function used from exactly one place.

- [ ] **Step 2: Type-check the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Redirect to the code-entry page after registering**

In `frontend/src/app/register/page.tsx`, find:

```ts
import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
```

Replace with:

```ts
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
```

Find:

```tsx
export default function RegisterPage() {
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: registerUser,
    onSuccess(data) {
      setServerMessage(data.message || "Registration successful! Please verify your email.");
      setApiError(null);
    },
    onError(error) {
      setApiError(getApiErrorMessage(error));
      setServerMessage(null);
    },
  });
```

Replace with:

```tsx
export default function RegisterPage() {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: registerUser,
    onSuccess(data) {
      router.push(`/verify-email?email=${encodeURIComponent(data.user.email)}`);
    },
    onError(error) {
      setApiError(getApiErrorMessage(error));
    },
  });
```

Find (the now-dead success banner — `serverMessage` no longer exists, since `onSuccess` navigates away instead of displaying it):

```tsx
        {serverMessage && <div className="p-3 mb-6 bg-green-50 text-green-700 rounded-xl text-sm border border-green-100">{serverMessage}</div>}
        {apiError && <div className="p-3 mb-6 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">{apiError}</div>}
```

Replace with:

```tsx
        {apiError && <div className="p-3 mb-6 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">{apiError}</div>}
```

- [ ] **Step 4: Type-check the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors. If you see `'setServerMessage' is not defined` or similar, you missed part of Step 3 — `grep -n "serverMessage" frontend/src/app/register/page.tsx` should now show zero matches.

- [ ] **Step 5: Add "Enter verification code" to the login page's unverified block**

In `frontend/src/app/login/page.tsx`, find:

```tsx
              {showChangeEmail && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Corrected email address"
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#EBA814]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      changeEmailMutation.mutate({
                        email: getValues("email"),
                        password: getValues("password"),
                        newEmail,
                      })
                    }
                    disabled={changeEmailMutation.isPending || !z.string().email().safeParse(newEmail).success}
                    className="px-4 py-2 bg-[#EBA814] hover:bg-[#D99810] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                  >
                    {changeEmailMutation.isPending ? "Updating…" : "Update"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
```

Replace with:

```tsx
              {showChangeEmail && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Corrected email address"
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#EBA814]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      changeEmailMutation.mutate({
                        email: getValues("email"),
                        password: getValues("password"),
                        newEmail,
                      })
                    }
                    disabled={changeEmailMutation.isPending || !z.string().email().safeParse(newEmail).success}
                    className="px-4 py-2 bg-[#EBA814] hover:bg-[#D99810] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                  >
                    {changeEmailMutation.isPending ? "Updating…" : "Update"}
                  </button>
                </div>
              )}
            </div>

            <Link
              href={`/verify-email?email=${encodeURIComponent(getValues("email"))}`}
              className="block text-sm font-semibold text-[#EBA814] hover:underline"
            >
              Enter verification code
            </Link>
          </div>
        )}
```

(`Link` is already imported at the top of this file — used by "Forgot Password?" and "Sign Up" — no new import needed.)

- [ ] **Step 6: Type-check the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Manual browser verification**

Start both servers (`cd backend && npm run dev`, `cd frontend && npm run dev`).

1. Register a new account with a throwaway email. Expected: redirected to `/verify-email?email=<that address>`, with the email field pre-filled.
2. Read the 6-digit code from the database (same one-off script as Task 1 Step 9 — the backend log never contains it, on success or failure).
3. Enter a wrong code, click "Verify Email". Expected: toast "Invalid or expired code", still on the same page.
4. Click "Resend code". Expected: a success toast, and the *previous* code should no longer work if tried afterward (a fresh one replaced it).
5. Enter the new correct code, click "Verify Email". Expected: success toast, redirected to `/login`.
6. Log in with an account you know is unverified. Expected: the amber block now shows three actions — Resend, Wrong email? Change it, and "Enter verification code" — and the last one navigates to `/verify-email` with the email pre-filled.
7. `grep -rn "verify-email?token" frontend backend` — expect zero matches anywhere in the codebase.

- [ ] **Step 8: Commit**

```bash
cd "/Users/joyntoghosh/Club Connect"
git add frontend/src/components/auth/VerifyEmail.tsx frontend/src/app/register/page.tsx "frontend/src/app/login/page.tsx"
git commit -m "$(cat <<'EOF'
Add code-entry UI for email verification

VerifyEmail.tsx rewritten as an email+code form (matching the
login/register branded style) instead of an auto-verifying link
handler, with its own resend action. Register now redirects there
after signup instead of showing a static message with no next step.
Login's existing unverified-account block gains a third link to the
same page, alongside the resend/change-email actions from earlier.
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** Goals (code instead of link, dedicated entry page, brute-force resistance) → Task 1 (code generation/expiry/verify logic/rate limiting) + Task 2 (entry page + two entry points). Non-goals (password reset untouched, no new lockout fields, no backward-compat link support) → verified nothing in either task touches `requestPasswordReset`/`resetPassword`/`createRandomToken`, no new Prisma fields introduced, and Step 7 of Task 2 explicitly checks no `?token=` link generation remains anywhere. Error handling (generic message, no enumeration) → Task 1 Step 4's rewritten `verifyEmail`. Verification section's manual steps → Task 1 Step 9 (backend branches) and Task 2 Step 7 (full browser flow) cover every bullet from the spec.
- **Placeholder scan:** no TBD/TODO; every code step shows complete, copy-pasteable content, including both `resendVerification` return-message edits in Task 1 Step 5 (the early-return message needed the same "link"→"code" wording fix as the main path — caught and included, not left as a loose end).
- **Type consistency:** `verifyMutation` in `VerifyEmail.tsx` (Task 2) posts `{email, code}` matching `emailVerificationSchema` (Task 1 Step 1) exactly. `resendVerification({email})` (Task 2, calling the pre-existing Task-1-of-the-*previous*-plan function) matches its already-established signature — confirmed unchanged by this plan. The login page's new `Link` reads `getValues("email")` the same way the existing resend/change-email buttons already do on that page.
- **Task ordering:** Task 1 (backend) before Task 2 (frontend) — Task 2's manual verification needs Task 1's endpoint contract (`POST {email, code}`) to exist, and directly calls it.
