# Global mutation error toasts — design

## Context

The frontend already uses `sonner` for toast notifications (`richColors`, ~14 call sites: login, register... actually register doesn't call toast today — see below), but error feedback across the app is inconsistent:

- **Toast** (nicest, already correct): login, verify-email, resend/change-email, several club/admin/event pages, profile — ~14 files call `toast.error(getApiErrorMessage(err))` on mutation failure today.
- **Inline banner only, no toast**: `frontend/src/app/register/page.tsx`, `frontend/src/app/forgot-password/page.tsx` — these set an `apiError` state shown in a `<div>`, but never call `toast.error`.
- **Nothing at all**: at least 13 files have `useMutation` calls with no `onError` handler whatsoever — including `frontend/src/app/(app)/notifications/page.tsx` (mark-as-read, mark-all-read, delete), `frontend/src/app/(app)/settings/sessions/page.tsx` (revoke session, revoke all), and others across admin/clubs/events pages. A failure in any of these is currently completely silent to the user.
- **Outside React Query entirely**: `frontend/src/components/shared/FileUpload.tsx` makes a raw `fetch()` call (not a `useMutation`) and only shows a small inline red error line, no toast.

Separately, a real pre-existing bug was found while investigating: `<Toaster>` is mounted twice — once in `frontend/src/app/providers.tsx`, once in `frontend/src/app/layout.tsx` — so every toast in the app currently renders twice, stacked.

## Goals

- Every mutation (user-triggered action with a pass/fail outcome) shows a toast on failure, app-wide, including the currently-silent ones.
- Fix the duplicate-toast bug as part of this pass.
- Do this with a centralized mechanism, not by editing every call site individually, so future mutations get this for free.

## Non-goals

- **Query (data-loading) failures** — e.g., a profile or stats page failing to load. This is a different problem shape: 15 files already show their own inline "failed to load" state via `useQuery`'s `error`/`isError`, and TanStack Query v5 removed per-query `onError` callbacks entirely (confirmed: no local-overrides-global merge exists for queries the way it does for mutations), so a global query-level toast would have no way to avoid double-messaging with those 15 existing inline states. Out of scope for this pass — a separate design if wanted.
- **Restyling the toast's visual appearance** — `richColors` is already enabled globally; this spec is about *coverage* (does a toast appear at all), not further visual redesign.
- **Editing all 13+ silent-mutation files individually** — the centralized `defaultOptions.mutations.onError` default (see below) covers them without touching any of those files.

## Architecture

TanStack Query v5's exact merge behavior, confirmed directly from the installed library's source (`frontend/node_modules/@tanstack/query-core/build/legacy/queryClient.js:296-306`):

```js
defaultMutationOptions(options) {
  return {
    ...this._defaultOptions.mutations,   // global default spread first
    ...options,                          // local useMutation options spread last — wins
    _defaulted: true,
  };
}
```

Because the local `useMutation({ onError })` is spread *after* the global default, a mutation that defines its own `onError` completely replaces the default — the two do not both fire. A mutation with no `onError` falls through to the default. This is exactly the fallback behavior needed: existing toast-using and banner-using pages keep their own handler untouched; silent pages get the toast for free.

## Changes

1. **`frontend/src/lib/queryClient.ts`** — add to the existing `defaultOptions`:
   ```ts
   mutations: {
     onError: (err: unknown) => { toast.error(getApiErrorMessage(err)); },
   },
   ```
   (imports: `toast` from `"sonner"`, `getApiErrorMessage` from `"@/lib/auth"` — both already used elsewhere in the frontend, no new dependency.)

2. **Fix the duplicate `<Toaster>`** — remove the one in `frontend/src/app/layout.tsx:71`, keep the one in `frontend/src/app/providers.tsx` (the more conventional placement — inside the client-side providers tree, not the root server layout).

3. **`frontend/src/app/register/page.tsx`, `frontend/src/app/forgot-password/page.tsx`** — add `toast.error(msg)` inside each page's existing `onError`, alongside the `apiError` state they already set. Matches the dual banner+toast pattern `frontend/src/app/login/page.tsx` already uses — not a new pattern.

4. **`frontend/src/components/shared/FileUpload.tsx`** — in `handleFile`'s catch block, add a `toast.error(...)` call using the exact same message the existing `setError(...)` call already computes (`err instanceof Error ? err.message : "Upload failed"`), alongside the existing inline error text. This is the one call site in the app outside React Query entirely, found while checking for other gaps; the centralized `QueryClient` default doesn't reach it since it isn't a mutation.

## Error handling

This spec *is* the error-handling change — no additional error handling needed within it. The generic-message anti-enumeration posture established earlier this session (in the auth-specific flows) is unaffected; this only adds a toast wrapper around whatever message `getApiErrorMessage` already extracts.

## Verification

No test framework in this repo (consistent project-wide convention). Manual:

- Trigger a currently-silent failure (e.g., call revoke-session on a session ID that no longer exists, or similar) and confirm a toast now appears where none did before.
- Confirm login and verify-email (both already call `toast.error` locally) still show exactly **one** toast per failure, not two — proving the local-overrides-global merge works as expected, not additively.
- Confirm every toast anywhere in the app now appears once, not twice (the duplicate-`Toaster` fix).
- Confirm register and forgot-password now show both the existing inline banner *and* a toast on failure.
- Confirm a failed avatar/logo/poster upload now shows a toast in addition to its existing inline error text.
