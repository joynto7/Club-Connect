# Email Verification Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user whose account is stuck unverified (mistyped/unreachable email at registration) fix it themselves — resend to the same address, or correct the address and get a fresh verification link — without needing an admin.

**Architecture:** One new backend endpoint, `POST /auth/change-unverified-email`, re-authenticates the user by password (since normal login is blocked pre-verification), updates their `email`, and re-sends the verification token to the new address using the exact same token/email machinery `register` already uses. The frontend wires this — plus the already-existing but currently-unreachable `resend-verification` endpoint — into the login page's dead-end "please verify your email" error state.

**Tech Stack:** Express + Prisma + Zod + bcryptjs + nodemailer (backend, all already dependencies), Next.js + React Hook Form + TanStack Query + sonner (frontend, all already dependencies). No test framework exists in this repo — verification is `tsc --noEmit` plus manual curl/browser checks.

**Full design context:** `docs/superpowers/specs/2026-07-20-email-verification-recovery-design.md` — read it if anything below is unclear on *why*, not just *what*.

## Global Constraints

- TypeScript everywhere; both apps must pass `npx tsc --noEmit` after every task.
- No new npm dependencies.
- No test framework — do not add Jest/Vitest/etc. Verify with `tsc --noEmit` and the curl/browser steps given in each task.
- Every new response reuses wording/status codes this codebase already returns for the same *kind* of fact: `401 "Invalid email or password"` (matches `login`), `409 "Email is already registered"` (matches `register`). `400 "This account is already verified. Please log in."` is new wording but the same status class as other precondition failures.
- The new endpoint is rate-limited with the existing `strictLimiter` (same tier as `/auth/login`) — not `authLimiter` (used by the password-less `resendVerification`).
- Frontend detects the "unverified" case via exact string match against `"Please verify your email before logging in."` — this repo has no structured error-code contract anywhere to extend; don't introduce one.
- Out of scope (do not build): admin-side override, changing email for an already-*verified* account, updating Render's production environment variables.

---

### Task 1: Backend — `change-unverified-email` endpoint

**Files:**
- Modify: `backend/src/controllers/authController.ts`
- Modify: `backend/src/routes/auth.ts`

**Interfaces:**
- Consumes: nothing new — uses `prisma`, `bcrypt`, `createRandomToken`, `sendEmail`, `frontendUrl`, all already defined earlier in `authController.ts`.
- Produces: `changeUnverifiedEmail: RequestHandler`, exported from `authController.ts`. Task 2 calls this over HTTP as `POST /auth/change-unverified-email` with body `{ email: string, password: string, newEmail: string }`, expecting:
  - `401 { error: "Invalid email or password" }` — email not found, or password wrong
  - `400 { error: "This account is already verified. Please log in." }` — account already verified
  - `409 { error: "Email is already registered" }` — `newEmail` taken by a different account
  - `200 { message: "Email updated. Please check your new inbox to verify your account." }` — success

- [ ] **Step 1: Add the request schema**

In `backend/src/controllers/authController.ts`, find:

```ts
const resendVerificationSchema = z.object({
  email: z.string().email(),
});
```

Replace with:

```ts
const resendVerificationSchema = z.object({
  email: z.string().email(),
});

const changeUnverifiedEmailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  newEmail: z.string().email(),
});
```

- [ ] **Step 2: Add the handler**

In the same file, find the end of `resendVerification` and the start of `login`:

```ts
  const verifyUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(emailVerificationToken)}`;
  await sendEmail(
    user.email,
    "Verify your Club Connect email",
    `<p>Hi ${user.name},</p><p>Click the link below to verify your email address:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`
  );

  return res.json({ message: "If the email is registered and unverified, a new verification link has been sent." });
};

export const login: RequestHandler = async (req, res) => {
```

Replace with:

```ts
  const verifyUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(emailVerificationToken)}`;
  await sendEmail(
    user.email,
    "Verify your Club Connect email",
    `<p>Hi ${user.name},</p><p>Click the link below to verify your email address:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`
  );

  return res.json({ message: "If the email is registered and unverified, a new verification link has been sent." });
};

// Lets a stuck-unverified user (wrong/unreachable email at registration) fix it
// themselves. Requires the password to prove ownership, since normal login is
// blocked pre-verification and there is no other way to authenticate them.
export const changeUnverifiedEmail: RequestHandler = async (req, res) => {
  const parseResult = changeUnverifiedEmailSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ errors: parseResult.error.format() });
  }

  const { email, password, newEmail } = parseResult.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  if (user.emailVerified) {
    return res.status(400).json({ error: "This account is already verified. Please log in." });
  }

  if (newEmail !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existing) {
      return res.status(409).json({ error: "Email is already registered" });
    }
  }

  const emailVerificationToken = createRandomToken();
  const emailVerificationTokenExpires = new Date(Date.now() + 1000 * 60 * 60 * 24);

  await prisma.user.update({
    where: { id: user.id },
    data: { email: newEmail, emailVerificationToken, emailVerificationTokenExpires },
  });

  const changeVerifyUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(emailVerificationToken)}`;
  await sendEmail(
    newEmail,
    "Verify your Club Connect email",
    `<p>Hi ${user.name},</p><p>Click the link below to verify your email address:</p><p><a href="${changeVerifyUrl}">${changeVerifyUrl}</a></p><p>This link expires in 24 hours.</p>`
  );

  return res.json({ message: "Email updated. Please check your new inbox to verify your account." });
};

export const login: RequestHandler = async (req, res) => {
```

- [ ] **Step 3: Wire the route**

In `backend/src/routes/auth.ts`, find:

```ts
import {
  login,
  logout,
  register,
  refreshToken,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  resendVerification,
  whoAmI,
```

Replace with:

```ts
import {
  login,
  logout,
  register,
  refreshToken,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  resendVerification,
  changeUnverifiedEmail,
  whoAmI,
```

Find:

```ts
router.post("/resend-verification", authLimiter, resendVerification);
```

Replace with:

```ts
router.post("/resend-verification", authLimiter, resendVerification);
router.post("/change-unverified-email", strictLimiter, changeUnverifiedEmail);
```

- [ ] **Step 4: Type-check the backend**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification — exercise every branch**

Start the backend locally: `cd backend && npm run dev`. Then, in another terminal:

```bash
# Register two throwaway users
curl -s -X POST http://127.0.0.1:5001/auth/register -H "Content-Type: application/json" \
  -d '{"name":"Test Recovery","email":"test-recovery-1@example.com","password":"testpass123"}'
curl -s -X POST http://127.0.0.1:5001/auth/register -H "Content-Type: application/json" \
  -d '{"name":"Test Taken","email":"test-recovery-taken@example.com","password":"testpass123"}'
```

Expected: both `201`, message `"Registration successful. Please check your email to verify your account."` (confirms `SKIP_EMAIL_VERIFICATION` is `false` — if you see "skipped for dev mode" instead, check `backend/.env`).

```bash
# Wrong password -> 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:5001/auth/change-unverified-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test-recovery-1@example.com","password":"wrongpassword","newEmail":"test-recovery-1-fixed@example.com"}'
```

Expected: `401`

```bash
# newEmail already taken by the other user -> 409
curl -s -X POST http://127.0.0.1:5001/auth/change-unverified-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test-recovery-1@example.com","password":"testpass123","newEmail":"test-recovery-taken@example.com"}'
```

Expected: `{"error":"Email is already registered"}`

```bash
# Correct password, free newEmail -> success
curl -s -X POST http://127.0.0.1:5001/auth/change-unverified-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test-recovery-1@example.com","password":"testpass123","newEmail":"test-recovery-1-fixed@example.com"}'
```

Expected: `{"message":"Email updated. Please check your new inbox to verify your account."}`

```bash
# Confirm the old email no longer resolves...
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:5001/auth/login \
  -H "Content-Type: application/json" -d '{"email":"test-recovery-1@example.com","password":"testpass123"}'
# Expected: 401

# ...and the new one does, still correctly gated on verification
curl -s -X POST http://127.0.0.1:5001/auth/login \
  -H "Content-Type: application/json" -d '{"email":"test-recovery-1-fixed@example.com","password":"testpass123"}'
# Expected: 403 {"error":"Please verify your email before logging in."}
```

For the "already verified" branch, flip the second throwaway user's status directly: `cd backend && npx prisma studio`, find the `test-recovery-taken@example.com` row in the `User` table, set `emailVerified` to `true`, save, then close Prisma Studio. Then:

```bash
curl -s -X POST http://127.0.0.1:5001/auth/change-unverified-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test-recovery-taken@example.com","password":"testpass123","newEmail":"whatever@example.com"}'
```

Expected: `{"error":"This account is already verified. Please log in."}`

- [ ] **Step 6: Commit**

```bash
cd "/Users/joyntoghosh/Club Connect"
git add backend/src/controllers/authController.ts backend/src/routes/auth.ts
git commit -m "$(cat <<'EOF'
Add change-unverified-email endpoint for stuck accounts

A user whose registration email was mistyped or unreachable can never
receive their verification token and is permanently blocked at login.
This endpoint re-authenticates them by password (login itself is
blocked pre-verification) and lets them correct the address, reusing
the same token/expiry/email machinery register() already uses.
EOF
)"
```

---

### Task 2: Frontend — wire resend + change-email into the login page

**Files:**
- Modify: `frontend/src/lib/auth.ts`
- Modify: `frontend/src/app/login/page.tsx`

**Interfaces:**
- Consumes: `POST /auth/change-unverified-email` and `POST /auth/resend-verification` from Task 1 (the latter already existed before this plan) — exact request/response shapes as documented in Task 1's Interfaces block.
- Produces: `resendVerification(payload: { email: string })`, `changeUnverifiedEmail(payload: { email: string, password: string, newEmail: string })`, both returning `Promise<{ message: string }>`, exported from `frontend/src/lib/auth.ts`. Nothing later in this plan consumes them — this is the last task.

- [ ] **Step 1: Add the two API functions**

In `frontend/src/lib/auth.ts`, find:

```ts
export async function resetPassword(payload: PasswordResetPayload) {
  const response = await api.post<{ message: string }>("/auth/reset-password", payload);
  return response.data;
}

// ── Profile ──────────────────────────────────────────────────────
```

Replace with:

```ts
export async function resetPassword(payload: PasswordResetPayload) {
  const response = await api.post<{ message: string }>("/auth/reset-password", payload);
  return response.data;
}

export type ResendVerificationPayload = {
  email: string;
};

export async function resendVerification(payload: ResendVerificationPayload) {
  const response = await api.post<{ message: string }>("/auth/resend-verification", payload);
  return response.data;
}

export type ChangeUnverifiedEmailPayload = {
  email: string;
  password: string;
  newEmail: string;
};

export async function changeUnverifiedEmail(payload: ChangeUnverifiedEmailPayload) {
  const response = await api.post<{ message: string }>("/auth/change-unverified-email", payload);
  return response.data;
}

// ── Profile ──────────────────────────────────────────────────────
```

- [ ] **Step 2: Type-check the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors (nothing consumes these yet).

- [ ] **Step 3: Import the new functions and add the detection constant**

In `frontend/src/app/login/page.tsx`, find:

```ts
import { loginUser, login2FA, getApiErrorMessage, buildAuthState, type LoginResponse } from "@/lib/auth";
```

Replace with:

```ts
import {
  loginUser, login2FA, getApiErrorMessage, buildAuthState, type LoginResponse,
  resendVerification, changeUnverifiedEmail,
} from "@/lib/auth";
```

Find:

```ts
const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;
```

Replace with:

```ts
const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Mirrors the exact string backend/src/controllers/authController.ts's login
// handler returns for an unverified account. No shared package between the
// two apps to enforce this — kept in sync by hand.
const EMAIL_NOT_VERIFIED_MESSAGE = "Please verify your email before logging in.";
```

- [ ] **Step 4: Add component state**

Find:

```ts
export default function LoginPage() {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
```

Replace with:

```ts
export default function LoginPage() {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
```

- [ ] **Step 5: Add the two mutations and expose `getValues`**

Find:

```ts
  const twoFAMutation = useMutation({
    mutationFn: ({ tempToken, token }: { tempToken: string; token: string }) => login2FA(tempToken, token),
    onSuccess(data) {
      setAuthState(buildAuthState(data));
      setApiError(null);
      toast.success("Welcome back!");
      router.push("/dashboard");
    },
    onError(error) {
      const msg = getApiErrorMessage(error);
      setApiError(msg);
      toast.error(msg);
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
```

Replace with:

```ts
  const twoFAMutation = useMutation({
    mutationFn: ({ tempToken, token }: { tempToken: string; token: string }) => login2FA(tempToken, token),
    onSuccess(data) {
      setAuthState(buildAuthState(data));
      setApiError(null);
      toast.success("Welcome back!");
      router.push("/dashboard");
    },
    onError(error) {
      const msg = getApiErrorMessage(error);
      setApiError(msg);
      toast.error(msg);
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

  const changeEmailMutation = useMutation({
    mutationFn: changeUnverifiedEmail,
    onSuccess(data) {
      toast.success(data.message);
      setApiError(null);
      setShowChangeEmail(false);
      setNewEmail("");
    },
    onError(error) {
      toast.error(getApiErrorMessage(error));
    },
  });

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginFormValues>({
```

- [ ] **Step 6: Add the inline UI block**

Find:

```tsx
        {apiError && <div className="p-3 mb-6 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">{apiError}</div>}
```

Replace with:

```tsx
        {apiError && <div className="p-3 mb-6 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">{apiError}</div>}

        {apiError === EMAIL_NOT_VERIFIED_MESSAGE && (
          <div className="p-4 mb-6 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
            <button
              type="button"
              onClick={() => resendMutation.mutate({ email: getValues("email") })}
              disabled={resendMutation.isPending}
              className="text-sm font-semibold text-[#EBA814] hover:underline disabled:opacity-60"
            >
              {resendMutation.isPending ? "Sending…" : "Resend verification email"}
            </button>

            <div>
              <button
                type="button"
                onClick={() => setShowChangeEmail((v) => !v)}
                className="text-sm font-semibold text-[#EBA814] hover:underline"
              >
                Wrong email? Change it
              </button>
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
                    disabled={changeEmailMutation.isPending || !newEmail}
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

- [ ] **Step 7: Type-check the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Manual browser verification**

Start both servers (`cd backend && npm run dev`, `cd frontend && npm run dev`). In the browser:

1. Register a new account (`/register`) with an email you don't control, e.g. `browsertest1@example.com`.
2. Go to `/login`, submit that email + the password you registered with.
3. Expected: the existing red error banner shows "Please verify your email before logging in.", **and** a new amber block appears below it with a "Resend verification email" link and a "Wrong email? Change it" link.
4. Click "Resend verification email". Expected: a success toast (the exact message `resendVerification` returns).
5. Click "Wrong email? Change it". Expected: an inline input + "Update" button appears.
6. Type a corrected address (e.g. `browsertest1-fixed@example.com`), click "Update". Expected: a success toast ("Email updated. Please check your new inbox to verify your account."), and the amber block disappears.
7. Submit the login form again with the *old* email. Expected: back to the plain "Invalid email or password" error (no amber block — the account no longer lives under that address).
8. Submit the login form with the *new* email (same password). Expected: the amber block reappears (still unverified) — confirms the account now lives under the corrected address and the gate still applies to it correctly.

- [ ] **Step 9: Commit**

```bash
cd "/Users/joyntoghosh/Club Connect"
git add frontend/src/lib/auth.ts "frontend/src/app/login/page.tsx"
git commit -m "$(cat <<'EOF'
Wire up unverified-email recovery on the login page

The login page previously showed the raw "please verify your email"
error with no way to act on it. Now offers resend-to-same-address
(the backend endpoint already existed, just had no frontend caller)
and correct-the-address-and-resend, using the email/password already
typed into the login form.
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** Goals (self-service resend + change-email) → Tasks 1 & 2 together. Non-goals (no admin override, no already-verified-account email change, no structured error codes, no Render env change) → nothing in either task touches these. Backend changes section → Task 1, checked branch-by-branch (401/401/400/409-conditional/200) against the spec's exact ordering. Frontend changes section → Task 2, checked the two lib functions and the login-page constant/state/mutations/UI against the spec's exact descriptions. Error handling section → Task 1's exact status codes/messages. Verification section's four bullets → Task 1 Step 5 (register, wrong-password, taken-email, success+old/new-email login checks) and Task 2 Step 8 (browser click-through) cover all four.
- **Placeholder scan:** found and fixed one real issue — Task 2 Step 9's commit message was originally copy-pasted from an unrelated prior plan ("Add tab bar navigation to Settings pages"); replaced with a message describing this task's actual change. No other TBD/TODO/placeholder found; every code step shows complete, copy-pasteable content.
- **Type consistency:** `ChangeUnverifiedEmailPayload` (Task 2) field names (`email`, `password`, `newEmail`) match `changeUnverifiedEmailSchema` (Task 1) exactly. `resendVerification`'s `{email: string}` (Task 2) matches the pre-existing `resendVerificationSchema` (already in the codebase, confirmed by direct read before writing this plan — not part of either task). Both Task 2 functions return `Promise<{message: string}>`, matching Task 1's `200` response shape and the pre-existing `resendVerification` endpoint's shape. Every "Find" block in both tasks was checked against the actual current file contents (read directly, not recalled) before being written into this plan.
- **Task ordering:** Task 1 before Task 2 — Task 2's manual verification (Step 8) requires Task 1's endpoint to exist and be running, and Task 2's `changeUnverifiedEmail`/`resendVerification` functions call routes Task 1 wires up (the latter already existed; the former is Task 1's deliverable).
