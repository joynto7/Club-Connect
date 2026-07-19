# Admin dashboard split — design

## Context

Club Connect has four platform roles (`Role` enum): `STUDENT`, `CLUB_OFFICER`, `UNIVERSITY_ADMIN`, `SYSTEM_ADMIN`. Today `UNIVERSITY_ADMIN` and `SYSTEM_ADMIN` are functionally identical — both render the same `AdminDashboard` component (`frontend/src/app/(app)/dashboard/page.tsx:517`), both pass the same `requireRole([UNIVERSITY_ADMIN, SYSTEM_ADMIN])` guard on every admin route (`backend/src/routes/admin.ts:29`), and the only distinction anywhere is a narrow rule preventing a `UNIVERSITY_ADMIN` from suspending or changing the role of a `SYSTEM_ADMIN` account.

The app is single-institution (no `University`/`Institution`/tenant model in the schema), so the split isn't about which university someone administers — it's a scope-of-responsibility split: day-to-day moderation vs. platform-level operations.

Separately, the sidebar (`AppShell.tsx`) has grown to 22 flat nav items with no visual grouping, and several items reuse the same icon for different destinations (a real point of confusion, not just clutter).

## Goals

- Give `UNIVERSITY_ADMIN` and `SYSTEM_ADMIN` genuinely different dashboards, nav, and backend permissions — `SYSTEM_ADMIN` is a strict superset of `UNIVERSITY_ADMIN`.
- Add a System Monitor capability for `SYSTEM_ADMIN`: app activity + security signals, built from data that already exists in the schema.
- Introduce a small, shared-shape permissions model (capability → allowed roles) so this isn't just more scattered `role === "X"` checks, and so it's easy to extend later.
- Reorganize the sidebar into grouped sections with section headers, and deduplicate colliding icons.

## Non-goals (explicitly out of scope)

- **Server/infra health monitoring** (CPU, memory, uptime for Render/Neon/Vercel) — that data already lives in each platform's own dashboard for free; pulling it into this app means new API integrations and stored credentials for something already visible elsewhere. Not building this now.
- **In-app error log viewer** — the backend's Winston logger only writes to console; Render already captures and displays that. Adding a DB-backed log store to duplicate it has the same cost/redundancy problem as infra monitoring above.
- **Migrating `STUDENT`/`CLUB_OFFICER` checks onto the new permissions model** — the new capability table is shaped so they *could* be folded in later, but their existing simple checks are untouched by this work.
- **Automated test framework** — this repo has no test runner today (no Jest/Vitest, no `test` script in either `package.json`). Adding one is a bigger project than this feature; verification here is manual (browser, per-role) plus a few curl checks against the backend, matching how this session already debugged the production OAuth/CORS issue.
- **Configurable/DB-backed permissions** — the capability table is a plain code-level config object, not an admin-editable UI. If permissions need to be runtime-configurable later, that's a separate, bigger piece of work.

## Permissions model

Each side (frontend, backend) gets its own capability-to-roles config, mirroring the same shape. There's no shared package between the Next.js frontend and Express backend, so "centralized" means *consistently named and shaped*, not one literal shared file.

```ts
const ROLE_CAPABILITIES = {
  approveClubs:        ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"],
  approveEvents:       ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"],
  viewContentReports:  ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"],
  viewAnalytics:       ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"],
  viewReports:         ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"],
  manageUsers:         ["SYSTEM_ADMIN"],
  viewSettings:        ["SYSTEM_ADMIN"],
  viewAuditLog:        ["SYSTEM_ADMIN"],
  viewSystemMonitor:   ["SYSTEM_ADMIN"],
} as const;
```

Note: `approveClubs` here means the admin capability to approve/reject *new club creation* requests (`bulkApproveClubs` and friends in `admin.ts`) — it's unrelated to a club officer approving membership requests into their own club, which is a separate feature on separate routes and isn't touched by this work.

## Backend changes

- New `requireCapability(capability)` in `backend/src/middleware/rbacMiddleware.ts`, implemented as `requireRole(ROLE_CAPABILITIES[capability])`.
- `backend/src/routes/admin.ts`: replace the single shared `adminOnly` guard with per-route capability guards. `/admin/settings`, `/admin/audit-log`, all of `/admin/users*` (list, suspend, activate, role change, bulk-suspend) move to `SYSTEM_ADMIN`-only capabilities. `/admin/clubs`, `/admin/events`, `/admin/content-reports`, `/admin/stats`, `/admin/analytics`, `/admin/reports`, bulk-approve routes stay on capabilities both admin roles have.
- Cleanup: in `adminController.ts`, remove the `"Only SYSTEM_ADMIN can change another SYSTEM_ADMIN's role"` check (~line 258) — it becomes unreachable dead code once the route itself is `SYSTEM_ADMIN`-only. Keep the sibling check "cannot suspend a `SYSTEM_ADMIN` at all," which still matters regardless of caller.
- New endpoint `GET /admin/system-monitor` (`requireCapability("viewSystemMonitor")`), returning:
  - Total users; signups over time (`User.createdAt` grouped by day)
  - Active sessions (`Session` rows not yet expired)
  - Suspended accounts (`User.isSuspended`)
  - Currently locked-out accounts (`User.lockedUntil` in the future) and accounts with elevated `loginAttempts` (security signals — uses existing lockout fields, no new schema)
  - 2FA adoption rate (`User.twoFactorEnabled` count / total)
  - Recent admin actions (latest rows from the existing `AuditLog` table)

## Frontend changes

**Dashboard:** split `AdminDashboard` into `UniversityAdminDashboard` (today's exact content unchanged) and `SystemAdminDashboard`, which renders `<UniversityAdminDashboard>` plus a new System Monitor summary card — no duplicated JSX, `SYSTEM_ADMIN` sees everything plus their own section.

**System Monitor detail page:** `/admin/system-monitor`, following the same pattern `/analytics` and `/admin/reports` already use — the dashboard card is a summary linking to this page for the full detail (signup chart, session activity, lockout list).

**Sidebar (`AppShell.tsx`):** `getNavItems(role)` restructures into four visually grouped sections with header labels (confirmed via mockup):
- **Main** — Dashboard, Feed, Events, Calendar, Clubs
- **Community** — Members, Venues, Resources, Leaderboard, Announcements
- **Personal** — My Bookings, My Payments, My Profile, My Activities
- **Settings** — Notifications, Sessions, Security
- **Admin** (role-gated via the capability table) — Admin Panel (the existing hub, unchanged: still the way to reach admin's club/event moderation views and Content Reports), Analytics, Reports for `UNIVERSITY_ADMIN`; additionally Users, System Settings, Audit Log, System Monitor as their own direct links for `SYSTEM_ADMIN`

  (Users and System Settings are new *direct* sidebar links — today they're only reachable through the Admin Panel hub. Audit Log was already a direct link; it just moves from "both admin roles" to "`SYSTEM_ADMIN` only." Content Reports and the admin clubs/events moderation views stay hub-only, unchanged — not promoted to direct links by this work.)

**Icon fixes** (deduplicating collisions found in the current code, keeping one icon per item — confirmed via mockup):
- Members: distinct member-card icon (was reusing Clubs' `Users2`)
- Admin Panel: distinct grid/panel icon (was reusing Security's `ShieldCheck`)
- Audit Log: distinct scroll/ledger icon (was reusing Reports' `FileText`)
- Events: distinct icon from Calendar (previously `Calendar` vs. `CalendarDays` — too visually similar at sidebar size)
- New items (Users, System Settings, System Monitor) get their own distinct icons, none reused

No emoji found anywhere in the existing sidebar/nav code — this was confirmed, not assumed; the ask is satisfied by the icon dedup above, not by removing anything that isn't there.

## Error handling

- Backend: unauthorized requests get a 403 from `requireCapability`, same pattern `requireRole` already uses today — no new error handling needed.
- Frontend: one small shared hook (e.g. `useRequireCapability(capability)`) that redirects to `/dashboard` if the current role lacks it, used at the top of `/admin/system-monitor`, `/admin/settings`, `/admin/audit-log`, and `/admin/users` — one implementation, four call sites, not four copies of the same check. Protects against a `UNIVERSITY_ADMIN` typing the URL directly and landing on a page full of silently-failed API calls.

## Verification

No test framework exists in this repo today (checked: no Jest/Vitest, no `test` script in either `package.json`) — adding one is out of scope for this feature. Verification is manual, matching how this session already debugged the production OAuth/CORS issue:

- Log in as `UNIVERSITY_ADMIN` and `SYSTEM_ADMIN` (promote a test account via direct DB edit or the existing `/admin/users/:id/role` endpoint) and confirm nav items, dashboard content, and direct-URL-navigation redirects are each correct per role.
- curl the `SYSTEM_ADMIN`-only routes (`/admin/settings`, `/admin/audit-log`, `/admin/users`) with a `UNIVERSITY_ADMIN` token and confirm a 403 comes back from the backend itself, not just a hidden button in the UI.
