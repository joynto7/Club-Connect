# Admin Dashboard Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `UNIVERSITY_ADMIN` and `SYSTEM_ADMIN` genuinely different dashboards, sidebar nav, and backend permissions (System Admin as a strict superset), add a System Monitor feature built from existing data, and reorganize the sidebar into grouped sections with deduplicated icons.

**Architecture:** A small `ROLE_CAPABILITIES` table (capability name → allowed roles) is introduced independently on each side — `backend/src/middleware/rbacMiddleware.ts` and `frontend/src/lib/permissions.ts` — since there's no shared package between the Express backend and Next.js frontend. Backend routes swap their existing `requireRole([...])` calls for `requireCapability("...")`. Frontend nav/dashboard/pages consult the same-shaped table via a `hasCapability()` helper and a `useRequireCapability()` redirect hook.

**Tech Stack:** Express + Prisma + Zod (backend), Next.js App Router + TanStack Query + lucide-react (frontend). No test framework exists in this repo — verification is `tsc --noEmit` plus manual curl/browser checks, per the approved spec.

**Full design context:** `docs/superpowers/specs/2026-07-19-admin-dashboard-split-design.md` — read it if anything below is unclear on *why*, not just *what*.

## Global Constraints

- TypeScript everywhere; both apps must pass `npx tsc --noEmit` after every task.
- No new database tables/columns — the System Monitor endpoint only reads existing `User`, `Session`, `AuditLog` fields.
- No new npm dependencies.
- No test framework — do not add Jest/Vitest/etc. Verify with `tsc --noEmit` and the curl/browser steps given in each task.
- Brand color `#EBA814` and the existing card style (`bg-white rounded-2xl shadow-sm p-6`) are the established visual language — match them, don't introduce a new one.
- Icons are lucide-react only, no emoji, one distinct icon per nav item (no reuse across different items).
- Every new/changed backend route keeps the existing `authenticateJWT` first, capability guard second ordering.

---

### Task 1: Backend capability model + wire it into existing route guards

**Files:**
- Modify: `backend/src/middleware/rbacMiddleware.ts`
- Modify: `backend/src/routes/admin.ts`
- Modify: `backend/src/routes/reports.ts`
- Modify: `backend/src/routes/clubs.ts`
- Modify: `backend/src/routes/events.ts`

**Interfaces:**
- Produces: `ROLE_CAPABILITIES` (const object), `Capability` (type — union of its keys), `requireCapability(capability: Capability): RequestHandler`, all exported from `backend/src/middleware/rbacMiddleware.ts`. Every later backend task imports `requireCapability` and `Capability` from there.

**Scope note:** `clubs.ts` also gates `DELETE /:id` (deactivateClub) and `PUT /:id/budget/allocate` (allocateBudget) behind the same two-role check — those are left untouched on the old `requireRole([...])` pattern. They're different features (club deactivation, budget allocation) not named in the approved spec's capability table; only club/event *approval* moves to the new system here.

- [ ] **Step 1: Add the capability table and `requireCapability` to the middleware**

Replace the full contents of `backend/src/middleware/rbacMiddleware.ts`:

```ts
import type { RequestHandler } from "express";
import { Role } from "@prisma/client";

export const requireRole = (allowedRoles: Role[]): RequestHandler => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient privileges" });
    }

    next();
  };
};

export const ROLE_CAPABILITIES = {
  viewDashboardStats: [Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN],
  approveClubs:       [Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN],
  approveEvents:      [Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN],
  viewContentReports: [Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN],
  viewAnalytics:      [Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN],
  viewReports:        [Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN],
  manageUsers:        [Role.SYSTEM_ADMIN],
  viewSettings:       [Role.SYSTEM_ADMIN],
  viewAuditLog:       [Role.SYSTEM_ADMIN],
  viewSystemMonitor:  [Role.SYSTEM_ADMIN],
} as const satisfies Record<string, Role[]>;

export type Capability = keyof typeof ROLE_CAPABILITIES;

export const requireCapability = (capability: Capability): RequestHandler =>
  requireRole(ROLE_CAPABILITIES[capability] as Role[]);
```

(Note: `Role` changes from a type-only import to a value import, since the capability table references its enum members directly.)

- [ ] **Step 2: Type-check the backend**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors (nothing consumes `requireCapability` yet, so this only validates the new file itself).

- [ ] **Step 3: Wire `admin.ts` to use named capabilities**

Replace the full contents of `backend/src/routes/admin.ts`:

```ts
import express from "express";
import { authenticateJWT } from "../middleware/authMiddleware.ts";
import { requireCapability } from "../middleware/rbacMiddleware.ts";
import {
  getAdminStats,
  listAdminUsers,
  suspendUser,
  activateUser,
  changeUserRole,
  listAdminClubs,
  listAdminEvents,
  listContentReports,
  resolveContentReport,
  dismissContentReport,
  getSystemSettings,
  upsertSystemSetting,
  getAuditLog,
  bulkApproveClubs,
  bulkApproveEvents,
  bulkSuspendUsers,
  getEmailDigestSub,
  upsertEmailDigestSub,
} from "../controllers/adminController.ts";
import { getAdminAnalytics } from "../controllers/analyticsController.ts";

const router = express.Router();

const canViewDashboardStats = [authenticateJWT, requireCapability("viewDashboardStats")];
const canApproveClubs       = [authenticateJWT, requireCapability("approveClubs")];
const canApproveEvents      = [authenticateJWT, requireCapability("approveEvents")];
const canViewContentReports = [authenticateJWT, requireCapability("viewContentReports")];
const canViewAnalytics      = [authenticateJWT, requireCapability("viewAnalytics")];
const canManageUsers        = [authenticateJWT, requireCapability("manageUsers")];
const canViewSettings       = [authenticateJWT, requireCapability("viewSettings")];
const canViewAuditLog       = [authenticateJWT, requireCapability("viewAuditLog")];

// Stats & analytics
router.get("/stats",     ...canViewDashboardStats, getAdminStats);
router.get("/analytics", ...canViewAnalytics, getAdminAnalytics);

// UC-7.1 / UC-7.2 — User management (System Admin only)
router.get("/users",               ...canManageUsers, listAdminUsers);
router.put("/users/:id/suspend",   ...canManageUsers, suspendUser);
router.put("/users/:id/activate",  ...canManageUsers, activateUser);
router.put("/users/:id/role",      ...canManageUsers, changeUserRole);

// UC-7.3 — Club oversight
router.get("/clubs",  ...canApproveClubs, listAdminClubs);

// UC-7.4 — Event oversight
router.get("/events", ...canApproveEvents, listAdminEvents);

// UC-7.5 — Content moderation
router.get("/content-reports",              ...canViewContentReports, listContentReports);
router.put("/content-reports/:id/resolve",  ...canViewContentReports, resolveContentReport);
router.put("/content-reports/:id/dismiss",  ...canViewContentReports, dismissContentReport);

// UC-7.6 — System settings (System Admin only)
router.get("/settings",    ...canViewSettings, getSystemSettings);
router.put("/settings",    ...canViewSettings, upsertSystemSetting);

// U10.2 — Audit log (System Admin only)
router.get("/audit-log",   ...canViewAuditLog, getAuditLog);

// U10.4 — Bulk operations
router.post("/clubs/bulk-approve",   ...canApproveClubs, bulkApproveClubs);
router.post("/events/bulk-approve",  ...canApproveEvents, bulkApproveEvents);
router.post("/users/bulk-suspend",   ...canManageUsers, bulkSuspendUsers);

// U10 — Email digest (any logged-in user)
router.get("/email-digest",  authenticateJWT, getEmailDigestSub);
router.put("/email-digest",  authenticateJWT, upsertEmailDigestSub);

export default router;
```

- [ ] **Step 4: Wire `reports.ts` to use `viewReports`**

Replace the full contents of `backend/src/routes/reports.ts`:

```ts
import express from "express";
import { authenticateJWT } from "../middleware/authMiddleware.ts";
import { requireCapability } from "../middleware/rbacMiddleware.ts";
import {
  listReports,
  generateReport,
  downloadReport,
  deleteReport,
  generateCertificate,
} from "../controllers/reportController.ts";

const router = express.Router();

const canViewReports = [authenticateJWT, requireCapability("viewReports")];

// UC-10.1 — Report management
router.get("/",                   ...canViewReports, listReports);
router.post("/generate",          ...canViewReports, generateReport);
router.get("/:id/download",       ...canViewReports, downloadReport);
router.delete("/:id",             ...canViewReports, deleteReport);

// U5.8 — Attendance certificate (any authenticated user, own cert only)
router.post("/certificate",       authenticateJWT, generateCertificate);

export default router;
```

- [ ] **Step 5: Migrate club approve/reject to `approveClubs` in `clubs.ts`**

In `backend/src/routes/clubs.ts`, add the import and change two lines. Find:

```ts
import { requireRole } from "../middleware/rbacMiddleware.ts";
```

Change to:

```ts
import { requireRole, requireCapability } from "../middleware/rbacMiddleware.ts";
```

Find (around line 51-54):

```ts
// Admin-only
router.post("/:id/approve",  authenticateJWT, requireRole([Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN]), approveClub);
router.post("/:id/reject",   authenticateJWT, requireRole([Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN]), rejectClub);
router.delete("/:id",        authenticateJWT, requireRole([Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN]), deactivateClub);
```

Replace with:

```ts
// Admin-only
router.post("/:id/approve",  authenticateJWT, requireCapability("approveClubs"), approveClub);
router.post("/:id/reject",   authenticateJWT, requireCapability("approveClubs"), rejectClub);
router.delete("/:id",        authenticateJWT, requireRole([Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN]), deactivateClub);
```

(`deactivateClub` and the later `budget/allocate` route at line 75 keep using `requireRole` directly — intentionally out of scope, see the Scope note above. `Role` and `requireRole` stay imported since both are still used by those two remaining routes.)

- [ ] **Step 6: Migrate event approve/reject to `approveEvents` in `events.ts`**

In `backend/src/routes/events.ts`, find (around line 46-58):

```ts
// Admin: approve / reject
router.post(
  "/:id/approve",
  authenticateJWT,
  requireRole([Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN]),
  approveEvent
);
router.post(
  "/:id/reject",
  authenticateJWT,
  requireRole([Role.UNIVERSITY_ADMIN, Role.SYSTEM_ADMIN]),
  rejectEvent
);
```

Replace with:

```ts
// Admin: approve / reject
router.post(
  "/:id/approve",
  authenticateJWT,
  requireCapability("approveEvents"),
  approveEvent
);
router.post(
  "/:id/reject",
  authenticateJWT,
  requireCapability("approveEvents"),
  rejectEvent
);
```

These were the *only* two `requireRole`/`Role` usages in this file, so both imports are now unused. Find:

```ts
import { Role } from "@prisma/client";
import { authenticateJWT, optionalAuth } from "../middleware/authMiddleware.ts";
import { requireRole } from "../middleware/rbacMiddleware.ts";
```

Replace with:

```ts
import { authenticateJWT, optionalAuth } from "../middleware/authMiddleware.ts";
import { requireCapability } from "../middleware/rbacMiddleware.ts";
```

- [ ] **Step 7: Type-check the backend**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors. This backend's `tsconfig.json` has `noUnusedLocals`/`noUnusedParameters` commented out, so a leftover unused `Role`/`requireRole` import will *not* show up as a type error — check for it directly instead: `grep -n "requireRole\|Role\." backend/src/routes/events.ts backend/src/routes/reports.ts` should show no matches in either file (both imports were fully removed from both). `grep -n "requireRole\|Role\." backend/src/routes/clubs.ts` should show exactly the two untouched routes from the Scope note (`deactivateClub`, `allocateBudget`).

- [ ] **Step 8: Manual verification — confirm the boundary actually moved**

Start the backend locally (`cd backend && npm run dev`), then log in as an existing `UNIVERSITY_ADMIN` test account to get an access token:

```bash
curl -s -X POST http://127.0.0.1:5001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_UNIVERSITY_ADMIN_EMAIL","password":"YOUR_PASSWORD"}' | grep -o '"accessToken":"[^"]*"'
```

Copy the token, then:

```bash
UADMIN_TOKEN="paste-the-token-here"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5001/admin/settings -H "Authorization: Bearer $UADMIN_TOKEN"
```

Expected: `403` (University Admin can no longer reach system settings). Then confirm University Admin still has what it should:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5001/admin/clubs -H "Authorization: Bearer $UADMIN_TOKEN"
```

Expected: `200`.

- [ ] **Step 9: Commit**

```bash
cd "/Users/joyntoghosh/Club Connect"
git add backend/src/middleware/rbacMiddleware.ts backend/src/routes/admin.ts backend/src/routes/reports.ts backend/src/routes/clubs.ts backend/src/routes/events.ts
git commit -m "$(cat <<'EOF'
Introduce capability-based route guards for admin roles

Adds ROLE_CAPABILITIES + requireCapability alongside the existing
requireRole, and migrates every admin-boundary route (admin.ts,
reports.ts, and club/event approve-reject) onto it. System settings,
audit log, and user management move to SYSTEM_ADMIN-only; club/event
approval, content reports, analytics, and reports stay shared between
both admin roles.
EOF
)"
```

---

### Task 2: Remove the now-dead role-change guard

**Files:**
- Modify: `backend/src/controllers/adminController.ts:258-260`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this is a pure deletion, no signature changes.

**Why now:** `changeUserRole` is only reachable via `PUT /admin/users/:id/role`, which Task 1 already moved to `requireCapability("manageUsers")` = `SYSTEM_ADMIN`-only. The inner check `target.role === Role.SYSTEM_ADMIN && req.user.role !== Role.SYSTEM_ADMIN` can now never be true (`req.user.role` is always `SYSTEM_ADMIN` by the time this line runs), so it's dead code.

- [ ] **Step 1: Delete the dead branch**

In `backend/src/controllers/adminController.ts`, find:

```ts
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.role === Role.SYSTEM_ADMIN && req.user.role !== Role.SYSTEM_ADMIN) {
    return res.status(403).json({ error: "Only SYSTEM_ADMIN can change another SYSTEM_ADMIN's role" });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role: parsed.data.role },
    select: { id: true, name: true, role: true },
  });
  void auditLog(req.user.id, "CHANGE_ROLE", "User", id, { oldRole: target.role, newRole: parsed.data.role }, req.ip);
```

Replace with:

```ts
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) return res.status(404).json({ error: "User not found" });

  const user = await prisma.user.update({
    where: { id },
    data: { role: parsed.data.role },
    select: { id: true, name: true, role: true },
  });
  void auditLog(req.user.id, "CHANGE_ROLE", "User", id, { oldRole: target.role, newRole: parsed.data.role }, req.ip);
```

(The sibling check in `suspendUser` — `if (target.role === Role.SYSTEM_ADMIN) return res.status(403)...` a few functions above — is untouched. It still matters: it protects a `SYSTEM_ADMIN` account from being suspended by *any* caller, not just a lower-privileged one.)

- [ ] **Step 2: Type-check the backend**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Using the `SYSTEM_ADMIN`-only guard from Task 1, this route is now unreachable by anyone but a `SYSTEM_ADMIN`, so the deleted branch had no remaining caller to test against. Confirm the route still works end-to-end for the case that matters — a `SYSTEM_ADMIN` changing a `STUDENT`'s role:

```bash
SADMIN_TOKEN="paste-a-system-admin-token-here"
STUDENT_ID="an-existing-student-user-id"
curl -s -X PUT "http://127.0.0.1:5001/admin/users/$STUDENT_ID/role" \
  -H "Authorization: Bearer $SADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"role":"CLUB_OFFICER"}'
```

Expected: `{"user":{...,"role":"CLUB_OFFICER"},"message":"Role updated"}`. Change it back to `STUDENT` afterward if this was a real test account.

- [ ] **Step 4: Commit**

```bash
cd "/Users/joyntoghosh/Club Connect"
git add backend/src/controllers/adminController.ts
git commit -m "Remove unreachable SYSTEM_ADMIN role-change check

The route is now SYSTEM_ADMIN-only at the guard level (Task 1), so
req.user.role can never be anything else here — the branch was dead."
```

---

### Task 3: Backend System Monitor endpoint

**Files:**
- Modify: `backend/src/controllers/adminController.ts` (add `getSystemMonitor`)
- Modify: `backend/src/routes/admin.ts` (add the route)

**Interfaces:**
- Consumes: `requireCapability` from Task 1 (`backend/src/middleware/rbacMiddleware.ts`).
- Produces: `getSystemMonitor: RequestHandler`, exported from `adminController.ts`. Later frontend tasks (Task 6) mirror this endpoint's exact JSON shape in a TypeScript type.

- [ ] **Step 1: Add the controller function**

In `backend/src/controllers/adminController.ts`, add this at the end of the file (after `upsertEmailDigestSub`):

```ts
// ── System Monitor — app activity + security signals ────────────────────────
export const getSystemMonitor: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeSessions,
    suspendedAccounts,
    lockedOutAccounts,
    elevatedLoginAttempts,
    twoFactorEnabledCount,
    signupsRaw,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.session.count({ where: { expiresAt: { gt: now } } }),
    prisma.user.count({ where: { isSuspended: true } }),
    prisma.user.count({ where: { lockedUntil: { gt: now } } }),
    prisma.user.count({ where: { loginAttempts: { gt: 0 } } }),
    prisma.user.count({ where: { twoFactorEnabled: true } }),
    prisma.user.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.auditLog.findMany({
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const signupsByDay = new Map<string, number>();
  for (const u of signupsRaw) {
    const day = u.createdAt.toISOString().slice(0, 10);
    signupsByDay.set(day, (signupsByDay.get(day) ?? 0) + 1);
  }
  const signupsOverTime = Array.from(signupsByDay.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return res.json({
    totalUsers,
    activeSessions,
    suspendedAccounts,
    lockedOutAccounts,
    elevatedLoginAttempts,
    twoFactorAdoption: totalUsers > 0 ? twoFactorEnabledCount / totalUsers : 0,
    signupsOverTime,
    recentAuditLogs: recentAuditLogs.map((l) => ({
      id: l.id,
      action: l.action,
      targetType: l.targetType,
      targetId: l.targetId,
      actorName: l.actor.name,
      createdAt: l.createdAt.toISOString(),
    })),
  });
};
```

- [ ] **Step 2: Wire the route**

In `backend/src/routes/admin.ts`, add `getSystemMonitor` to the import block. Find:

```ts
import {
  getAdminStats,
  listAdminUsers,
```

Replace with:

```ts
import {
  getAdminStats,
  getSystemMonitor,
  listAdminUsers,
```

Then add a new guard constant and route. Find:

```ts
const canViewAuditLog       = [authenticateJWT, requireCapability("viewAuditLog")];
```

Replace with:

```ts
const canViewAuditLog       = [authenticateJWT, requireCapability("viewAuditLog")];
const canViewSystemMonitor  = [authenticateJWT, requireCapability("viewSystemMonitor")];
```

Find:

```ts
// U10.2 — Audit log (System Admin only)
router.get("/audit-log",   ...canViewAuditLog, getAuditLog);
```

Replace with:

```ts
// U10.2 — Audit log (System Admin only)
router.get("/audit-log",   ...canViewAuditLog, getAuditLog);

// System Monitor (System Admin only)
router.get("/system-monitor", ...canViewSystemMonitor, getSystemMonitor);
```

- [ ] **Step 3: Type-check the backend**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

```bash
SADMIN_TOKEN="paste-a-system-admin-token-here"
curl -s http://127.0.0.1:5001/admin/system-monitor -H "Authorization: Bearer $SADMIN_TOKEN" | head -c 500
```

Expected: JSON with `totalUsers`, `activeSessions`, `suspendedAccounts`, `lockedOutAccounts`, `elevatedLoginAttempts`, `twoFactorAdoption`, `signupsOverTime`, `recentAuditLogs` keys. Then confirm a `UNIVERSITY_ADMIN` is rejected:

```bash
UADMIN_TOKEN="paste-a-university-admin-token-here"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5001/admin/system-monitor -H "Authorization: Bearer $UADMIN_TOKEN"
```

Expected: `403`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/joyntoghosh/Club Connect"
git add backend/src/controllers/adminController.ts backend/src/routes/admin.ts
git commit -m "Add GET /admin/system-monitor endpoint

App activity + security signals built entirely from existing User,
Session, and AuditLog data — no new tables. SYSTEM_ADMIN only."
```

---

### Task 4: Frontend permissions mirror + capability redirect hook

**Files:**
- Create: `frontend/src/lib/permissions.ts`
- Create: `frontend/src/hooks/useRequireCapability.ts`

**Interfaces:**
- Produces: `ROLE_CAPABILITIES` (const), `Capability` (type), `hasCapability(role: string, capability: Capability): boolean` from `frontend/src/lib/permissions.ts`. `useRequireCapability(capability: Capability): void` from `frontend/src/hooks/useRequireCapability.ts`. Tasks 5, 6, 8 all import from these two files.

- [ ] **Step 1: Create the frontend capability table**

Create `frontend/src/lib/permissions.ts`:

```ts
export const ROLE_CAPABILITIES = {
  viewDashboardStats: ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"],
  approveClubs:       ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"],
  approveEvents:      ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"],
  viewContentReports: ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"],
  viewAnalytics:      ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"],
  viewReports:        ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"],
  manageUsers:        ["SYSTEM_ADMIN"],
  viewSettings:       ["SYSTEM_ADMIN"],
  viewAuditLog:       ["SYSTEM_ADMIN"],
  viewSystemMonitor:  ["SYSTEM_ADMIN"],
} as const;

export type Capability = keyof typeof ROLE_CAPABILITIES;

export function hasCapability(role: string, capability: Capability): boolean {
  return (ROLE_CAPABILITIES[capability] as readonly string[]).includes(role);
}
```

This must stay in sync with `backend/src/middleware/rbacMiddleware.ts`'s `ROLE_CAPABILITIES` by hand — there's no shared package between the two apps to enforce it automatically (see the spec's Permissions Model section for why).

- [ ] **Step 2: Create the redirect hook**

Create `frontend/src/hooks/useRequireCapability.ts`:

```ts
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthState } from "@/lib/tokenStorage";
import { hasCapability, type Capability } from "@/lib/permissions";

export function useRequireCapability(capability: Capability) {
  const router = useRouter();

  useEffect(() => {
    const auth = getAuthState();
    if (!auth || !hasCapability(auth.user.role, capability)) {
      router.replace("/dashboard");
    }
  }, [capability, router]);
}
```

- [ ] **Step 3: Type-check the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors (nothing consumes these yet).

- [ ] **Step 4: Commit**

```bash
cd "/Users/joyntoghosh/Club Connect"
git add frontend/src/lib/permissions.ts frontend/src/hooks/useRequireCapability.ts
git commit -m "Add frontend capability table + useRequireCapability hook

Mirrors the backend's ROLE_CAPABILITIES shape (kept in sync by hand,
no shared package between the two apps). Not wired into any page yet."
```

---

### Task 5: Wire the capability guard into the three System-Admin-only pages

**Files:**
- Modify: `frontend/src/app/(app)/admin/settings/page.tsx:19`
- Modify: `frontend/src/app/(app)/admin/audit-log/page.tsx:81`
- Modify: `frontend/src/app/(app)/admin/users/page.tsx:21`

**Interfaces:**
- Consumes: `useRequireCapability` from Task 4.

- [ ] **Step 1: Guard the settings page**

In `frontend/src/app/(app)/admin/settings/page.tsx`, find:

```ts
import { getSystemSettings, upsertSystemSetting, type SystemConfig } from "@/lib/admin";
```

Replace with:

```ts
import { getSystemSettings, upsertSystemSetting, type SystemConfig } from "@/lib/admin";
import { useRequireCapability } from "@/hooks/useRequireCapability";
```

Find:

```ts
export default function AdminSettingsPage() {
  const qc = useQueryClient();
```

Replace with:

```ts
export default function AdminSettingsPage() {
  useRequireCapability("viewSettings");
  const qc = useQueryClient();
```

- [ ] **Step 2: Guard the audit log page**

In `frontend/src/app/(app)/admin/audit-log/page.tsx`, find:

```ts
import { getAuditLog, type AuditEntry } from "@/lib/admin";
import { format } from "date-fns";
```

Replace with:

```ts
import { getAuditLog, type AuditEntry } from "@/lib/admin";
import { format } from "date-fns";
import { useRequireCapability } from "@/hooks/useRequireCapability";
```

Find:

```ts
export default function AuditLogPage() {
```

Replace with:

```ts
export default function AuditLogPage() {
  useRequireCapability("viewAuditLog");
```

- [ ] **Step 3: Guard the users page**

In `frontend/src/app/(app)/admin/users/page.tsx`, find:

```ts
import {
  listAdminUsers, suspendUser, activateUser, changeUserRole, bulkSuspendUsers,
  type AdminUser,
} from "@/lib/admin";
import { toast } from "sonner";
```

Replace with:

```ts
import {
  listAdminUsers, suspendUser, activateUser, changeUserRole, bulkSuspendUsers,
  type AdminUser,
} from "@/lib/admin";
import { toast } from "sonner";
import { useRequireCapability } from "@/hooks/useRequireCapability";
```

Find:

```ts
export default function AdminUsersPage() {
```

Replace with:

```ts
export default function AdminUsersPage() {
  useRequireCapability("manageUsers");
```

- [ ] **Step 4: Type-check the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual browser verification**

Start the frontend (`cd frontend && npm run dev`) and backend locally. Log in as a `UNIVERSITY_ADMIN` test account, then navigate directly to `http://localhost:3000/admin/settings` (typing the URL, not clicking a nav link). Expected: immediately redirected to `/dashboard`. Repeat for `/admin/audit-log` and `/admin/users` — same expected redirect. Then log in as a `SYSTEM_ADMIN` test account and confirm all three pages load normally instead.

- [ ] **Step 6: Commit**

```bash
cd "/Users/joyntoghosh/Club Connect"
git add "frontend/src/app/(app)/admin/settings/page.tsx" "frontend/src/app/(app)/admin/audit-log/page.tsx" "frontend/src/app/(app)/admin/users/page.tsx"
git commit -m "Redirect University Admin away from System-Admin-only pages

Settings, audit log, and users pages now check capability client-side
and bounce to /dashboard if the current role doesn't have it — the
backend already 403s these, this closes the same gap for direct URL
navigation instead of a page full of silently-failed API calls."
```

---

### Task 6: Frontend System Monitor API client + detail page

**Files:**
- Modify: `frontend/src/lib/admin.ts`
- Create: `frontend/src/app/(app)/admin/system-monitor/page.tsx`

**Interfaces:**
- Consumes: `useRequireCapability` from Task 4.
- Produces: `SystemMonitorStats` (type), `getSystemMonitor(): Promise<SystemMonitorStats>` from `frontend/src/lib/admin.ts`. Task 7 imports both.

- [ ] **Step 1: Add the type and API function**

In `frontend/src/lib/admin.ts`, add this after the `SystemSettingsResponse` type (before the `// ── API functions ──` comment):

```ts
// ── System Monitor types ─────────────────────────────────────────────────────
export type SystemMonitorStats = {
  totalUsers: number;
  activeSessions: number;
  suspendedAccounts: number;
  lockedOutAccounts: number;
  elevatedLoginAttempts: number;
  twoFactorAdoption: number;
  signupsOverTime: Array<{ date: string; count: number }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    targetType: string;
    targetId: string;
    actorName: string;
    createdAt: string;
  }>;
};
```

Then add the API function anywhere in the `// ── API functions ──` section, e.g. right after `getAdminStats`:

```ts
export async function getSystemMonitor() {
  const r = await api.get<SystemMonitorStats>("/admin/system-monitor");
  return r.data;
}
```

- [ ] **Step 2: Create the detail page**

Create `frontend/src/app/(app)/admin/system-monitor/page.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Users, ShieldOff, UserX, ShieldCheck, TrendingUp } from "lucide-react";
import { getSystemMonitor } from "@/lib/admin";
import { useRequireCapability } from "@/hooks/useRequireCapability";

function StatTile({ icon, label, value, loading }: {
  icon: React.ReactNode; label: string; value: number | string | undefined; loading: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#EBA814]/10 flex items-center justify-center text-[#EBA814] flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">{loading ? "—" : value ?? 0}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function SystemMonitorPage() {
  useRequireCapability("viewSystemMonitor");

  const { data, isLoading } = useQuery({
    queryKey: ["system-monitor"],
    queryFn: getSystemMonitor,
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">System Monitor</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatTile icon={<Users size={20} />} label="Total Users" value={data?.totalUsers} loading={isLoading} />
        <StatTile icon={<Activity size={20} />} label="Active Sessions" value={data?.activeSessions} loading={isLoading} />
        <StatTile icon={<UserX size={20} />} label="Suspended Accounts" value={data?.suspendedAccounts} loading={isLoading} />
        <StatTile icon={<ShieldOff size={20} />} label="Locked Out" value={data?.lockedOutAccounts} loading={isLoading} />
        <StatTile icon={<ShieldOff size={20} />} label="Elevated Login Attempts" value={data?.elevatedLoginAttempts} loading={isLoading} />
        <StatTile
          icon={<ShieldCheck size={20} />}
          label="2FA Adoption"
          value={data ? `${Math.round(data.twoFactorAdoption * 100)}%` : undefined}
          loading={isLoading}
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-[#EBA814]" /> Signups (last 30 days)
        </h2>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : !data || data.signupsOverTime.length === 0 ? (
          <p className="text-sm text-gray-500">No signups in the last 30 days.</p>
        ) : (
          <div className="space-y-1">
            {data.signupsOverTime.map((d) => (
              <div key={d.date} className="flex items-center gap-3 text-sm">
                <span className="w-24 text-gray-400 shrink-0">{d.date}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-[#EBA814] rounded-full"
                    style={{ width: `${Math.min(100, d.count * 10)}%` }}
                  />
                </div>
                <span className="w-8 text-right text-gray-600 font-medium">{d.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-base font-bold text-gray-900 mb-4">Recent Admin Actions</h2>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : !data || data.recentAuditLogs.length === 0 ? (
          <p className="text-sm text-gray-500">No recent admin actions.</p>
        ) : (
          <div className="space-y-2">
            {data.recentAuditLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-gray-50">
                <span className="text-gray-700">
                  <span className="font-semibold">{log.actorName}</span> — {log.action.replace(/_/g, " ").toLowerCase()}
                </span>
                <span className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual browser verification**

Log in as a `SYSTEM_ADMIN` test account, navigate to `http://localhost:3000/admin/system-monitor`. Expected: page loads, six stat tiles show real numbers (not stuck on "—"), signup bars render if any users signed up in the last 30 days, recent admin actions list shows entries if any exist (empty state text otherwise). Log in as `UNIVERSITY_ADMIN` and confirm navigating to the same URL redirects to `/dashboard` (this exercises Task 4's hook end-to-end for the first time).

- [ ] **Step 5: Commit**

```bash
cd "/Users/joyntoghosh/Club Connect"
git add frontend/src/lib/admin.ts "frontend/src/app/(app)/admin/system-monitor/page.tsx"
git commit -m "Add System Monitor detail page

Stat tiles, 30-day signup chart, and recent admin actions, all backed
by GET /admin/system-monitor. SYSTEM_ADMIN only."
```

---

### Task 7: Split the admin dashboard

**Files:**
- Modify: `frontend/src/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getSystemMonitor`, `type SystemMonitorStats` from `@/lib/admin` (Task 6).
- Produces: `UniversityAdminDashboard`, `SystemAdminDashboard` (both `{ user: UserInfo }` components), replacing the removed `AdminDashboard`.

- [ ] **Step 1: Add the new imports**

Find:

```ts
import { getAdminStats } from "@/lib/admin";
```

Replace with:

```ts
import { getAdminStats, getSystemMonitor, type SystemMonitorStats } from "@/lib/admin";
```

Find:

```ts
import {
  Calendar, Users2, History, ArrowRight, Clock, MapPin,
  Users, Building2, Activity, AlertCircle, CheckCircle,
  UserCheck, Package, Megaphone, Trophy, Star,
} from "lucide-react";
```

Replace with:

```ts
import {
  Calendar, Users2, History, ArrowRight, Clock, MapPin,
  Users, Building2, Activity, AlertCircle, CheckCircle,
  UserCheck, Package, Megaphone, Trophy, Star,
  ShieldOff, UserX, ShieldCheck,
} from "lucide-react";
```

- [ ] **Step 2: Rename `AdminDashboard` to `UniversityAdminDashboard`**

Find (the section header comment and function signature only — the body between them is unchanged):

```ts
// ── Admin Dashboard ──────────────────────────────────────────────────────────

const activityIcons: Record<string, React.ReactNode> = {
  CLUB_CREATED:  <Building2 size={16} />,
  EVENT_CREATED: <Calendar size={16} />,
  USER_JOINED:   <UserCheck size={16} />,
};

const activityAccent: Record<string, string> = {
  CLUB_CREATED:  "bg-purple-50 text-purple-500",
  EVENT_CREATED: "bg-[#EBA814]/10 text-[#EBA814]",
  USER_JOINED:   "bg-blue-50 text-blue-500",
};

function AdminDashboard({ user }: { user: UserInfo }) {
```

Replace with:

```ts
// ── University Admin Dashboard ───────────────────────────────────────────────

const activityIcons: Record<string, React.ReactNode> = {
  CLUB_CREATED:  <Building2 size={16} />,
  EVENT_CREATED: <Calendar size={16} />,
  USER_JOINED:   <UserCheck size={16} />,
};

const activityAccent: Record<string, string> = {
  CLUB_CREATED:  "bg-purple-50 text-purple-500",
  EVENT_CREATED: "bg-[#EBA814]/10 text-[#EBA814]",
  USER_JOINED:   "bg-blue-50 text-blue-500",
};

function UniversityAdminDashboard({ user }: { user: UserInfo }) {
```

Everything else inside the function (the two `useEffect`s, the four `handle*Action` functions, and the full JSX return) stays exactly as-is — do not touch the body.

- [ ] **Step 3: Add `SystemAdminDashboard` right after it**

Find the closing of the function (the line right before `// ── Page entry point ──`):

```ts
      )}
    </div>
  );
}

// ── Page entry point ─────────────────────────────────────────────────────────
```

Replace with:

```ts
      )}
    </div>
  );
}

// ── System Admin Dashboard ────────────────────────────────────────────────────

function SystemAdminDashboard({ user }: { user: UserInfo }) {
  const [monitor, setMonitor] = useState<SystemMonitorStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSystemMonitor().then(setMonitor).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <UniversityAdminDashboard user={user} />

      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">System Monitor</h2>
          <Link href="/admin/system-monitor" className="text-xs font-semibold text-[#EBA814] hover:underline flex items-center gap-1">
            Full report <ArrowRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            icon={<Activity size={22} />}
            label="Active Sessions"
            value={loading ? "—" : monitor?.activeSessions ?? 0}
            href="/admin/system-monitor"
            accent="blue"
          />
          <StatCard
            icon={<ShieldOff size={22} />}
            label="Locked Out"
            value={loading ? "—" : monitor?.lockedOutAccounts ?? 0}
            href="/admin/system-monitor"
            accent={monitor?.lockedOutAccounts ? "red" : "green"}
          />
          <StatCard
            icon={<UserX size={22} />}
            label="Suspended"
            value={loading ? "—" : monitor?.suspendedAccounts ?? 0}
            href="/admin/system-monitor"
            accent={monitor?.suspendedAccounts ? "red" : "green"}
          />
          <StatCard
            icon={<ShieldCheck size={22} />}
            label="2FA Adoption"
            value={loading ? "—" : `${Math.round((monitor?.twoFactorAdoption ?? 0) * 100)}%`}
            href="/admin/system-monitor"
            accent="purple"
          />
        </div>
      </div>
    </div>
  );
}

// ── Page entry point ─────────────────────────────────────────────────────────
```

- [ ] **Step 4: Update the routing at the bottom**

Find:

```ts
  if (user.role === "UNIVERSITY_ADMIN" || user.role === "SYSTEM_ADMIN") {
    return <AdminDashboard user={user} />;
  }
  if (user.role === "CLUB_OFFICER") {
    return <OfficerDashboard user={user} />;
  }
  return <StudentDashboard user={user} />;
```

Replace with:

```ts
  if (user.role === "SYSTEM_ADMIN") {
    return <SystemAdminDashboard user={user} />;
  }
  if (user.role === "UNIVERSITY_ADMIN") {
    return <UniversityAdminDashboard user={user} />;
  }
  if (user.role === "CLUB_OFFICER") {
    return <OfficerDashboard user={user} />;
  }
  return <StudentDashboard user={user} />;
```

- [ ] **Step 5: Type-check the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors. If you see `'AdminDashboard' is not defined` anywhere, you missed a reference — `grep -n "AdminDashboard" "frontend/src/app/(app)/dashboard/page.tsx"` should now only show `UniversityAdminDashboard` and `SystemAdminDashboard`, never the bare old name.

- [ ] **Step 6: Manual browser verification**

Log in as `UNIVERSITY_ADMIN`, go to `/dashboard`. Expected: identical to before this task — pending approvals, stats, announcements, no System Monitor section. Log in as `SYSTEM_ADMIN`, go to `/dashboard`. Expected: everything University Admin sees, *plus* a "System Monitor" card with 4 stat tiles and a "Full report" link that goes to the Task 6 page.

- [ ] **Step 7: Commit**

```bash
cd "/Users/joyntoghosh/Club Connect"
git add "frontend/src/app/(app)/dashboard/page.tsx"
git commit -m "Split AdminDashboard into University/System Admin dashboards

SystemAdminDashboard renders UniversityAdminDashboard plus a new
System Monitor summary card — no duplicated JSX, System Admin sees
everything University Admin sees plus their own section."
```

---

### Task 8: Reorganize the sidebar into grouped sections with deduplicated icons

**Files:**
- Modify: `frontend/src/components/layout/AppShell.tsx`

**Interfaces:**
- Consumes: `hasCapability` from `@/lib/permissions` (Task 4).

- [ ] **Step 1: Update imports**

Find:

```ts
import {
  LayoutDashboard, Calendar, Users2, User, History, LogOut,
  Menu, Building2, Package, BookMarked, ChevronRight,
  Megaphone, Settings, BarChart2, ShieldCheck, Monitor,
  FileText, PanelLeftClose, PanelLeftOpen, Command, Rss, Trophy, CalendarDays, CreditCard,
} from "lucide-react";
import { getAuthState, clearAuthState } from "@/lib/tokenStorage";
import type { UserInfo } from "@/lib/tokenStorage";
```

Replace with:

```ts
import {
  LayoutDashboard, CalendarClock, Users2, IdCard, User, History, LogOut,
  Menu, Building2, Package, BookMarked, ChevronRight,
  Megaphone, Settings, SlidersHorizontal, BarChart2, ShieldCheck, Monitor,
  FileText, ScrollText, LayoutGrid, UserCog, Activity,
  PanelLeftClose, PanelLeftOpen, Command, Rss, Trophy, CalendarDays, CreditCard,
} from "lucide-react";
import { getAuthState, clearAuthState } from "@/lib/tokenStorage";
import type { UserInfo } from "@/lib/tokenStorage";
import { hasCapability } from "@/lib/permissions";
```

(`Calendar` is dropped from this import — it's no longer used once Events switches to `CalendarClock` below; `Users2` stays since Clubs still uses it.)

- [ ] **Step 2: Replace `getNavItems` with grouped `getNavGroups`**

Find the entire function:

```ts
type NavItem = { label: string; href: string; icon: React.ReactNode; exact?: boolean };

function getNavItems(role: string): NavItem[] {
  const base: NavItem[] = [
    { label: "Dashboard",     href: "/dashboard",              icon: <LayoutDashboard size={18} /> },
    { label: "Feed",          href: "/feed",                   icon: <Rss size={18} /> },
    { label: "Events",        href: "/events",                 icon: <Calendar size={18} /> },
    { label: "Calendar",      href: "/calendar",               icon: <CalendarDays size={18} /> },
    { label: "Clubs",         href: "/clubs",                  icon: <Users2 size={18} /> },
    { label: "Members",       href: "/members",                icon: <Users2 size={18} /> },
    { label: "Venues",        href: "/venues",                 icon: <Building2 size={18} /> },
    { label: "Resources",     href: "/resources",              icon: <Package size={18} /> },
    { label: "My Bookings",   href: "/my-bookings",            icon: <BookMarked size={18} /> },
    { label: "My Payments",   href: "/my-payments",            icon: <CreditCard size={18} /> },
    { label: "My Profile",    href: "/profile",                icon: <User size={18} /> },
    { label: "My Activities", href: "/activities",             icon: <History size={18} /> },
    { label: "Leaderboard",   href: "/leaderboard",            icon: <Trophy size={18} /> },
    { label: "Announcements", href: "/announcements",          icon: <Megaphone size={18} /> },
    { label: "Settings",      href: "/settings/notifications", icon: <Settings size={18} /> },
    { label: "Sessions",      href: "/settings/sessions",      icon: <Monitor size={18} /> },
    { label: "Security",      href: "/settings/security",      icon: <ShieldCheck size={18} /> },
  ];
  if (role === "UNIVERSITY_ADMIN" || role === "SYSTEM_ADMIN") {
    base.push({ label: "Analytics",   href: "/analytics",      icon: <BarChart2 size={18} /> });
    base.push({ label: "Reports",     href: "/admin/reports",  icon: <FileText size={18} /> });
    base.push({ label: "Admin Panel", href: "/admin",          icon: <ShieldCheck size={18} />, exact: true });
    base.push({ label: "Audit Log",   href: "/admin/audit-log", icon: <FileText size={18} /> });
  }
  return base;
}
```

Replace with:

```ts
type NavItem = { label: string; href: string; icon: React.ReactNode; exact?: boolean };
type NavGroup = { label: string; items: NavItem[] };

function getNavGroups(role: string): NavGroup[] {
  const groups: NavGroup[] = [
    {
      label: "Main",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard size={18} /> },
        { label: "Feed",      href: "/feed",      icon: <Rss size={18} /> },
        { label: "Events",    href: "/events",    icon: <CalendarClock size={18} /> },
        { label: "Calendar",  href: "/calendar",  icon: <CalendarDays size={18} /> },
        { label: "Clubs",     href: "/clubs",     icon: <Users2 size={18} /> },
      ],
    },
    {
      label: "Community",
      items: [
        { label: "Members",       href: "/members",       icon: <IdCard size={18} /> },
        { label: "Venues",        href: "/venues",        icon: <Building2 size={18} /> },
        { label: "Resources",     href: "/resources",     icon: <Package size={18} /> },
        { label: "Leaderboard",   href: "/leaderboard",   icon: <Trophy size={18} /> },
        { label: "Announcements", href: "/announcements", icon: <Megaphone size={18} /> },
      ],
    },
    {
      label: "Personal",
      items: [
        { label: "My Bookings",   href: "/my-bookings", icon: <BookMarked size={18} /> },
        { label: "My Payments",   href: "/my-payments", icon: <CreditCard size={18} /> },
        { label: "My Profile",    href: "/profile",     icon: <User size={18} /> },
        { label: "My Activities", href: "/activities",  icon: <History size={18} /> },
      ],
    },
    {
      label: "Settings",
      items: [
        { label: "Notifications", href: "/settings/notifications", icon: <Settings size={18} /> },
        { label: "Sessions",      href: "/settings/sessions",       icon: <Monitor size={18} /> },
        { label: "Security",      href: "/settings/security",       icon: <ShieldCheck size={18} /> },
      ],
    },
  ];

  const adminItems: NavItem[] = [];
  if (hasCapability(role, "viewAnalytics")) {
    adminItems.push({ label: "Admin Panel", href: "/admin",         icon: <LayoutGrid size={18} />, exact: true });
    adminItems.push({ label: "Analytics",   href: "/analytics",     icon: <BarChart2 size={18} /> });
    adminItems.push({ label: "Reports",     href: "/admin/reports", icon: <FileText size={18} /> });
  }
  if (hasCapability(role, "manageUsers")) {
    adminItems.push({ label: "Users", href: "/admin/users", icon: <UserCog size={18} /> });
  }
  if (hasCapability(role, "viewSettings")) {
    adminItems.push({ label: "System Settings", href: "/admin/settings", icon: <SlidersHorizontal size={18} /> });
  }
  if (hasCapability(role, "viewAuditLog")) {
    adminItems.push({ label: "Audit Log", href: "/admin/audit-log", icon: <ScrollText size={18} /> });
  }
  if (hasCapability(role, "viewSystemMonitor")) {
    adminItems.push({ label: "System Monitor", href: "/admin/system-monitor", icon: <Activity size={18} /> });
  }
  if (adminItems.length > 0) {
    groups.push({ label: "Admin", items: adminItems });
  }

  return groups;
}
```

- [ ] **Step 3: Update the render call site**

Find:

```ts
  const navItems = getNavItems(user.role);
```

Replace with:

```ts
  const navGroups = getNavGroups(user.role);
```

- [ ] **Step 4: Replace the flat `<nav>` render with grouped rendering**

Find:

```tsx
      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href || (!item.exact && pathname.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              title={collapsed && !mobile ? item.label : undefined}
              className={`flex items-center gap-3 rounded-xl text-sm font-medium transition-all group ${
                collapsed && !mobile ? "justify-center px-2 py-3" : "px-3 py-2.5"
              } ${
                active
                  ? "bg-[#EBA814]/10 text-[#EBA814]"
                  : "text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <span className={`flex-shrink-0 ${active ? "text-[#EBA814]" : "text-gray-400 dark:text-zinc-500 group-hover:text-gray-600 dark:group-hover:text-white"}`}>
                {item.icon}
              </span>
              {(!collapsed || mobile) && (
                <>
                  {item.label}
                  {active && <ChevronRight size={14} className="ml-auto text-[#EBA814]" />}
                </>
              )}
            </Link>
          );
        })}
      </nav>
```

Replace with:

```tsx
      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            {(!collapsed || mobile) && (
              <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-600">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || (!item.exact && pathname.startsWith(item.href + "/"));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    title={collapsed && !mobile ? item.label : undefined}
                    className={`flex items-center gap-3 rounded-xl text-sm font-medium transition-all group ${
                      collapsed && !mobile ? "justify-center px-2 py-3" : "px-3 py-2.5"
                    } ${
                      active
                        ? "bg-[#EBA814]/10 text-[#EBA814]"
                        : "text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    <span className={`flex-shrink-0 ${active ? "text-[#EBA814]" : "text-gray-400 dark:text-zinc-500 group-hover:text-gray-600 dark:group-hover:text-white"}`}>
                      {item.icon}
                    </span>
                    {(!collapsed || mobile) && (
                      <>
                        {item.label}
                        {active && <ChevronRight size={14} className="ml-auto text-[#EBA814]" />}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
```

- [ ] **Step 5: Type-check the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors. This project doesn't enable `noUnusedLocals`, so a leftover unused `Calendar` import would *not* surface as a type error — confirm directly instead: `grep -n "Calendar[,)]" frontend/src/components/layout/AppShell.tsx` should show no plain `Calendar` icon usage (only `CalendarClock` and `CalendarDays`).

- [ ] **Step 6: Manual browser verification**

Log in as `STUDENT`. Expected: sidebar shows Main/Community/Personal/Settings section headers, no Admin group, collapsed sidebar still shows icons with no headers/labels (unchanged collapse behavior). Log in as `UNIVERSITY_ADMIN`. Expected: additionally an Admin group with Admin Panel, Analytics, Reports only (no Users/System Settings/Audit Log/System Monitor). Log in as `SYSTEM_ADMIN`. Expected: Admin group has all seven items. Confirm Members and Clubs now show visibly different icons (member-card vs. people), and Events/Calendar are visibly different from each other.

- [ ] **Step 7: Commit**

```bash
cd "/Users/joyntoghosh/Club Connect"
git add frontend/src/components/layout/AppShell.tsx
git commit -m "Reorganize sidebar into grouped sections, deduplicate icons

Main/Community/Personal/Settings/Admin groups with visible headers,
replacing the flat 22-item list. Admin group is built from the same
capability table the backend uses, so University Admin and System
Admin see different subsets automatically. Fixes icon collisions:
Members vs Clubs, Admin Panel vs Security, Audit Log vs Reports,
Events vs Calendar all now have distinct icons."
```

---

## Self-Review Notes

- **Spec coverage:** every section of the design doc maps to a task — permissions model → Tasks 1 & 4; backend route changes → Task 1; dead-code cleanup → Task 2; System Monitor endpoint → Task 3; System Monitor frontend → Tasks 6 & 7; dashboard split → Task 7; sidebar reorg + icon fixes → Task 8; frontend capability guard on pages → Task 5. Nothing in the spec is unaddressed.
- **Placeholder scan:** no TBD/TODO markers; every step has complete, copy-pasteable code; curl verification steps use a placeholder *token value* (`paste-the-token-here`) because a real token is per-environment secret data, not a deferred design decision — the surrounding steps show exactly how to obtain one.
- **Type consistency:** `SystemMonitorStats` (Task 6, frontend) field names match `getSystemMonitor`'s JSON response shape (Task 3, backend) exactly — checked field-by-field. `Capability` type and `ROLE_CAPABILITIES` keys match between backend (Task 1) and frontend (Task 4) mirrors. `hasCapability(role, capability)` (Task 4) signature matches every call site in Tasks 5, 6, 8.
- **Task ordering:** Task 3 (system-monitor endpoint) must land before Task 6 (frontend client) and Task 7 (dashboard card), which both consume it. Task 4 (permissions/hook) must land before Tasks 5, 6, 8, which all import from it. Task 1 must land before Tasks 2 and 3, which both touch the same route file. This ordering is reflected in the task numbering above — execute in order.
