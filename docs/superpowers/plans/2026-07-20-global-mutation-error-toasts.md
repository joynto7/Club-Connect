# Global Mutation Error Toasts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every mutation failure app-wide shows a toast, via one centralized default instead of editing every call site, plus fix a pre-existing duplicate-toast bug.

**Architecture:** `frontend/src/lib/queryClient.ts` gets a `defaultOptions.mutations.onError` that shows a toast — confirmed from the installed `@tanstack/query-core` source that this is silently skipped (not double-fired) for any mutation that already defines its own `onError`, so existing toast/banner behavior elsewhere is untouched. Two pages that currently only show an inline banner (register, forgot-password) get a toast added to their existing `onError`, matching the pattern `login` already uses. The one non-React-Query API call in the app (`FileUpload.tsx`) gets the same treatment directly. A duplicate `<Toaster>` mount is removed.

**Tech Stack:** `sonner` (toast library, already a dependency, already has a `<Toaster richColors>` mounted), `@tanstack/react-query` v5 (already a dependency). No new dependencies.

**Full design context:** `docs/superpowers/specs/2026-07-20-global-mutation-error-toasts.md` — read it if anything below is unclear on *why*, not just *what*.

## Global Constraints

- No new npm dependencies.
- No test framework — do not add Jest/Vitest/etc. Verify with `tsc --noEmit` and the manual browser steps below.
- Do not touch query (data-loading) error handling — this plan is mutations only. The 15 files that already show their own inline "failed to load" state via `useQuery`'s `error`/`isError` are out of scope.
- Do not restyle the toast's appearance — `richColors` is already enabled; this is about coverage, not visual redesign.
- A mutation that already defines its own `onError` must keep behaving exactly as it does today — the centralized default must never cause a double toast for it.

---

### Task 1: Centralized default + duplicate-toast fix + the four call sites needing an explicit toast

**Files:**
- Modify: `frontend/src/lib/queryClient.ts`
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/app/register/page.tsx`
- Modify: `frontend/src/app/forgot-password/page.tsx`
- Modify: `frontend/src/components/shared/FileUpload.tsx`

**Interfaces:**
- Consumes: `getApiErrorMessage` (already exported from `frontend/src/lib/auth.ts`, unchanged), `toast` from the `sonner` package (already a dependency).
- Produces: nothing new consumed elsewhere — this is the only task in this plan.

- [ ] **Step 1: Add the centralized mutation default**

In `frontend/src/lib/queryClient.ts`, replace the full file contents:

```ts
"use client";

import { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/auth";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 1000 * 60 * 2,
    },
    mutations: {
      onError: (err) => {
        toast.error(getApiErrorMessage(err));
      },
    },
  },
});
```

- [ ] **Step 2: Remove the duplicate `<Toaster>` in the root layout**

In `frontend/src/app/layout.tsx`, find:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import Providers from "./providers";
import "./globals.css";
```

Replace with:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "./providers";
import "./globals.css";
```

Find:

```tsx
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          {children}
          <Toaster richColors position="top-right" closeButton />
        </Providers>
      </body>
    </html>
  );
}
```

Replace with:

```tsx
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

(The `<Toaster>` already mounted inside `frontend/src/app/providers.tsx` — unchanged by this task — is the one that remains.)

- [ ] **Step 3: Add a toast to the register page's existing error handler**

In `frontend/src/app/register/page.tsx`, find:

```ts
import { registerUser, getApiErrorMessage } from "@/lib/auth";
import { Mail, Lock, User, Eye, EyeOff, Building2, GraduationCap } from "lucide-react";
```

Replace with:

```ts
import { registerUser, getApiErrorMessage } from "@/lib/auth";
import { Mail, Lock, User, Eye, EyeOff, Building2, GraduationCap } from "lucide-react";
import { toast } from "sonner";
```

Find:

```ts
    onError(error) {
      setApiError(getApiErrorMessage(error));
    },
```

Replace with:

```ts
    onError(error) {
      const msg = getApiErrorMessage(error);
      setApiError(msg);
      toast.error(msg);
    },
```

- [ ] **Step 4: Add a toast to the forgot-password page's existing error handler**

In `frontend/src/app/forgot-password/page.tsx`, find:

```ts
import { requestPasswordReset, getApiErrorMessage } from "@/lib/auth";
```

Replace with:

```ts
import { requestPasswordReset, getApiErrorMessage } from "@/lib/auth";
import { toast } from "sonner";
```

Find:

```ts
    onError(error) {
      setApiError(getApiErrorMessage(error));
      setServerMessage(null);
    },
```

Replace with:

```ts
    onError(error) {
      const msg = getApiErrorMessage(error);
      setApiError(msg);
      setServerMessage(null);
      toast.error(msg);
    },
```

- [ ] **Step 5: Add a toast to the file-upload component's existing catch block**

In `frontend/src/components/shared/FileUpload.tsx`, find:

```ts
import { useRef, useState } from "react";
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";
import { getAuthState } from "@/lib/tokenStorage";
```

Replace with:

```ts
import { useRef, useState } from "react";
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";
import { getAuthState } from "@/lib/tokenStorage";
import { toast } from "sonner";
```

Find:

```ts
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
```

Replace with:

```ts
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
```

- [ ] **Step 6: Type-check the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors. If you see `'Toaster' is declared but its value is never read` or similar for `layout.tsx`, you missed removing the import in Step 2 — `grep -n "Toaster" frontend/src/app/layout.tsx` should show zero matches. `grep -n "Toaster" frontend/src/app/providers.tsx` should still show exactly one (unchanged).

- [ ] **Step 7: Manual verification**

Start both servers (`cd backend && npm run dev`, `cd frontend && npm run dev`).

1. **Duplicate-toast fix:** log in with a wrong password. Expected: exactly **one** red error toast appears (previously this would have shown two, stacked, since `<Toaster>` was mounted twice).
2. **Centralized default reaches a previously-silent mutation:** go to `/settings/sessions`, find a session in the list, click its revoke button **twice in quick succession** (before the list has a chance to re-render and remove it) — the second click sends a revoke request for a session ID that's already gone. Expected: a toast now appears for that second, failing request ("Session not found" or similar) — this mutation had *no* `onError` before this task, so nothing would have appeared previously.
3. **Local `onError` still wins, no double toast:** repeat the wrong-password login from step 1 again and count the toasts — still exactly one, confirming the centralized default did not *also* fire alongside `login`'s own existing `onError`.
4. **Register / forgot-password now show a toast too:** register with an email that's already taken. Expected: both the existing red inline banner **and** a toast appear. Repeat on `/forgot-password` is optional (same code shape, lower priority to re-check live).
5. **Upload failure shows a toast:** on `/profile` (edit mode), attempt to upload a file over 5MB or a non-image file through the avatar picker. Expected: the existing small inline red error text **and** a toast both appear.

- [ ] **Step 8: Commit**

```bash
cd "/Users/joyntoghosh/Club Connect"
git add frontend/src/lib/queryClient.ts frontend/src/app/layout.tsx frontend/src/app/register/page.tsx frontend/src/app/forgot-password/page.tsx frontend/src/components/shared/FileUpload.tsx
git commit -m "$(cat <<'EOF'
Show a toast on every mutation failure, app-wide

Adds defaultOptions.mutations.onError to the shared QueryClient
instead of editing every call site — confirmed from the installed
@tanstack/query-core source (queryClient.js's defaultMutationOptions)
that a mutation's own onError silently overrides this default rather
than both firing, so existing toast/banner behavior is unaffected.
This covers every currently-silent mutation (session revocation,
notification actions, etc.) for free, and for anything added later.

Also: removes a duplicate <Toaster> mount (layout.tsx had one,
providers.tsx had another — every toast was rendering twice), and
adds a toast to the three places with only an inline error message
today (register, forgot-password, and the one upload component that
makes a raw fetch call outside React Query entirely).
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** Goals (toast on every mutation failure, centralized mechanism, fix duplicate) → Task 1 Steps 1-5. Non-goals (queries untouched, no restyling, no per-file editing for the silent gaps) → satisfied by construction — no `useQuery` files are touched, no styling props changed, and the ~13 silent files aren't edited (they're covered by Step 1's default alone). Architecture section's merge-order claim → not re-derived here, already verified directly against the installed library source during brainstorming; Step 7 Item 3 re-confirms it behaves as expected live. Verification section's five bullets → Task 1 Step 7, same five checks in the same order.
- **Placeholder scan:** no TBD/TODO; every step shows complete, copy-pasteable code; the commit message states facts already verified (source-code confirmation) rather than assuming.
- **Type consistency:** `onError: (err) => { toast.error(getApiErrorMessage(err)); }` in `queryClient.ts` matches `getApiErrorMessage(error: unknown)`'s existing signature (accepts anything, no type mismatch). The `msg` local variable pattern in Steps 3-5 is used identically to how `login/page.tsx`'s existing `onError` already does it (`const msg = getApiErrorMessage(error); setApiError(msg); toast.error(msg);`) — matching, not inventing a new shape.
- **Task ordering:** single task, no ordering constraints. All five file edits are independent of each other (no file's correctness depends on another file's edit landing first), but are grouped into one task since they're all small parts of the same "make failures visible" pass and share one round of verification.
