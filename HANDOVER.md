# Club Connect — Handover Document

**Date:** 2026-06-08
**Original phases complete:** 1–10 (all 73 use cases)
**Upgrade phases complete:** U1 — UI Polish, U2 — Real-Time, U3 — File Uploads + Rich Text, U4 — Social & Community, U5 — Gamification, U6 — Smart Event UX, U7 — AI Features, U8 — Calendar, U9 — PWA & Mobile Push, U10 — Advanced Admin & Audit, U11 — Payments & Institutional
**Status: Active upgrade in progress — see upgradePlan.md for full 12-phase roadmap**

### U10 — Advanced Admin & Audit (COMPLETE 2026-06-08)

**Schema additions:** `AuditLog` model (actor, action, targetType, targetId, details JSON, ipAddress), `EmailDigestSubscription` model, `twoFactorSecret String?` + `twoFactorEnabled Boolean` on `User`.

**Backend — `backend/src/lib/auditLog.ts`:** `log(actorId, action, targetType, targetId, details, ip)` — fire-and-forget audit entry creator.

**Audit logging wired into:** all admin controller mutations (suspend/activate user, change role, resolve/dismiss content report, upsert setting), club approve/reject (`clubController.ts`), event approve/reject (`eventController.ts`).

**Bulk operations (all admin-only, POST):**
- `POST /admin/clubs/bulk-approve` — body `{ ids }` → approves PENDING clubs
- `POST /admin/events/bulk-approve` — body `{ ids }` → approves PENDING_APPROVAL events
- `POST /admin/users/bulk-suspend` — body `{ ids, reason? }` → suspends non-SYSTEM_ADMIN users

**Audit Log endpoint:** `GET /admin/audit-log?action=&from=&to=&q=&page=` — paginated, includes actor details.

**Email digest:** `GET/PUT /admin/email-digest` — upserts `EmailDigestSubscription` for logged-in user with frequency `DAILY|WEEKLY|NONE`.

**2FA (TOTP via `otplib` v13 functional API + `qrcode`):**
- `POST /auth/2fa/setup` — generates TOTP secret, returns `{ secret, qrDataUrl }`
- `POST /auth/2fa/verify` — verifies 6-digit code, sets `twoFactorEnabled = true`
- `POST /auth/2fa/disable` — verifies code, clears secret and disables
- `POST /auth/2fa/login` — accepts `{ tempToken, token }` → returns full JWT pair
- Login flow: if `twoFactorEnabled`, login returns `{ requires2FA: true, tempToken }` (200) instead of tokens; second call to `/auth/2fa/login` completes authentication.

**Frontend new pages:**
- `frontend/src/app/(app)/admin/audit-log/page.tsx` — filterable audit log table (date range, action type, actor search)
- `frontend/src/app/(app)/settings/security/page.tsx` — 2FA setup/enable/disable flow with QR code display

**Frontend updated pages:**
- `admin/clubs/page.tsx` — checkbox column + bulk approve toolbar
- `admin/events/page.tsx` — checkbox column + bulk approve toolbar
- `admin/users/page.tsx` — checkbox column + bulk suspend toolbar
- `login/page.tsx` — handles `requires2FA` response, shows 6-digit OTP input as second step

**AppShell nav additions:** "Security" (`/settings/security`) for all users; "Audit Log" (`/admin/audit-log`) for admins.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4, TanStack React Query v5, React Hook Form + Zod, Axios, Lucide React |
| Backend | Express v5 (ESM), TypeScript, Prisma v7 + PostgreSQL |
| Real-time | Socket.io — authenticated via JWT in `handshake.auth.token`; rooms: `user:{id}`, `event:{id}`, `admin` |
| Auth | JWT access tokens (15 min) + refresh tokens (7 days) stored in DB |
| Config | `exactOptionalPropertyTypes: true` — always use `?? null`, never `undefined`, for optional Prisma fields |

---

## Architecture Notes

- **Route groups:** `frontend/src/app/(app)/` — all authenticated pages share a layout that wraps `<InactivityTimer>` + `<AppShell>` (sidebar nav).
- **Auth middleware:** `authenticateJWT` (blocks unauthenticated) vs `optionalAuth` (attaches `req.user` silently — used for public club/event GET routes).
- **RBAC:** system role (`Role` enum on `User`) + club-level role (`ClubRole` on `ClubMembership`). `requireRole([...])` middleware enforces system roles; club-officer checks are done inside controllers using `ClubMembership`.
- **Express 5 params:** always access as `req.params["id"] as string` — the type is `string | string[] | undefined`.
- **Inactivity timer:** 28-min warning modal + 30-min hard logout. Resets on mouse/keyboard/touch/scroll.
- **Password strength:** 3-bar indicator (weak/medium/strong) on register and reset-password pages.
- **Notification service:** `notificationService.ts` provides fire-and-forget `createNotification` / `createBulkNotifications` — errors are swallowed so they never break the calling request. All triggers use `void`.

---

## Database — Migrations Applied

| Migration | What it added |
|---|---|
| `20260528093315_init` | `User`, `Club`, `Event`, `EventAttendance` base models; `Role`, `EventAttendanceStatus` enums |
| `20260601070157_add_event_models` | Extended `Event` / `EventAttendance` relations |
| `20260606105232_add_user_profile_fields` | `User`: `department`, `year`, `interests[]`, `avatarUrl`, `isSuspended`, `suspendedReason` |
| `20260606112225_add_club_management` | `Club`: `description`, `category`, `logoUrl`, `bannerUrl`, `contactEmail`, `phone`, `socialLinks` (Json), `tags[]`, `status` (ClubStatus), `approvalNote`. New model `ClubMembership`. New enums `ClubStatus`, `ClubRole`, `MembershipStatus` |
| `20260606122518_add_event_phase3` | `Event`: `status` (EventStatus), `category`, `registrationDeadline`, `posterUrl`, `contactPerson`, `approvalNote`, `maxWaitlist`. `EventAttendance`: `isWaitlisted`, `checkedIn`, `checkedInAt`. New enum `EventStatus` (`DRAFT \| PENDING_APPROVAL \| APPROVED \| REJECTED \| CANCELLED`) |
| `20260606131740_add_venue_resource_booking` | New models `Venue`, `VenueBooking`, `Resource`, `ResourceBooking`. New enum `BookingStatus` (`PENDING \| APPROVED \| REJECTED \| CANCELLED`). Reverse relations on `User`, `Club`, `Event` |
| `20260606133624_add_notifications_announcements` | New models `Notification`, `Announcement`, `NotificationPreference`. New enum `NotificationType` (12 values). Relations added to `User` and `Club` |
| `20260606161107_add_feedback_analytics` | New model `EventFeedback` (eventId, userId, rating 1–5, comment, categoryRatings JSON). Unique constraint `[eventId, userId]`. Relations added to `User` and `Event` |
| `20260606163615_add_admin_panel` | New models `ContentReport` (reporter, targetType, targetId, reason, description, status, resolvedBy, resolvedNote), `SystemConfig` (key unique, value, label). New enum `ReportStatus` (`PENDING \| RESOLVED \| DISMISSED`). Relations `contentReportsSubmitted` + `contentReportsResolved` added to `User` |
| `20260606170042_add_sessions_login_attempts` | `User`: `loginAttempts Int @default(0)`, `lockedUntil DateTime?`, `sessions Session[]`. New model `Session` (id, userId, tokenHash unique, userAgent, ipAddress, expiresAt) |
| `20260606171720_add_reports` | New model `Report` (id, type, format, name, params Json, generatedById, createdAt). `reports Report[]` relation added to `User` |

> No schema changes in Phase 4 — all data already existed.
>
> Run `npx prisma generate` from `backend/` after any schema change.

---

## Files — Created / Modified

### Phase 1 — Auth & User Profile

| File | Purpose |
|---|---|
| `backend/prisma/schema.prisma` | Added profile + account-status fields to `User` |
| `backend/src/controllers/authController.ts` | `whoAmI` fetches full DB profile; `register` accepts `department`/`year` |
| `backend/src/controllers/userController.ts` ✦ | `getMyProfile`, `updateMyProfile`, `getMyHistory` |
| `backend/src/routes/users.ts` ✦ | `GET /users/me`, `PUT /users/me`, `GET /users/me/history` |
| `backend/src/index.ts` | Mounts `/users` |
| `frontend/src/lib/tokenStorage.ts` | Extended `UserInfo` with profile fields |
| `frontend/src/lib/auth.ts` | Added profile + history API functions |
| `frontend/src/components/shared/PasswordStrengthIndicator.tsx` ✦ | 3-bar strength meter |
| `frontend/src/components/shared/InactivityTimer.tsx` ✦ | 28-min warning / 30-min logout |
| `frontend/src/components/layout/AppShell.tsx` ✦ | Sidebar nav with avatar, logout, role-aware links |
| `frontend/src/app/(app)/layout.tsx` ✦ | Route-group layout wrapping `InactivityTimer` + `AppShell` |
| `frontend/src/app/login/page.tsx` | Redirects to `/dashboard` on success |
| `frontend/src/app/register/page.tsx` | Added `department`/`year` + `PasswordStrengthIndicator` |
| `frontend/src/app/(app)/dashboard/page.tsx` ✦ | Stats cards + upcoming events (rewritten in Phase 4, extended in Phase 6) |
| `frontend/src/app/(app)/profile/page.tsx` ✦ | View + edit own profile |
| `frontend/src/app/(app)/activities/page.tsx` ✦ | Participation history (upcoming events, past events, clubs) |

### Phase 2 — Club Management

| File | Purpose |
|---|---|
| `backend/prisma/schema.prisma` | Added `ClubMembership` model + club fields + 3 enums |
| `backend/src/middleware/authMiddleware.ts` | Added `optionalAuth` |
| `backend/src/controllers/clubController.ts` ✦ | 13 handlers: list, get, create, approve, reject, deactivate, update, listMembers, requestMembership, approveMembership, rejectMembership, updateMemberRole, removeMember |
| `backend/src/routes/clubs.ts` ✦ | All club routes with auth/RBAC middleware |
| `backend/src/index.ts` | Mounts `/clubs` |
| `frontend/src/lib/clubs.ts` ✦ | All types + API functions + `CATEGORIES` array |
| `frontend/src/app/(app)/clubs/page.tsx` ✦ | Club directory: grid + search + category filter |
| `frontend/src/app/(app)/clubs/new/page.tsx` ✦ | Club creation request form |
| `frontend/src/app/(app)/clubs/[slug]/page.tsx` ✦ | Club profile: join/leave/pending, officers + members |
| `frontend/src/app/(app)/clubs/[slug]/manage/page.tsx` ✦ | 3-tab management: Pending Requests · Members · Edit Club Info |

### Phase 3 — Event Management

| File | Purpose |
|---|---|
| `backend/prisma/schema.prisma` | Extended `Event` + `EventAttendance`; added `EventStatus` enum |
| `backend/src/controllers/eventController.ts` ✦ | Full rewrite — 12 handlers (see API table) |
| `backend/src/routes/events.ts` ✦ | Full rewrite — `optionalAuth` on public GETs, admin RBAC on approve/reject |
| `frontend/src/lib/events.ts` ✦ | All types (`Event`, `EventDetail`, `Attendee`, etc.) + all API functions |
| `frontend/src/app/(app)/events/page.tsx` ✦ | Event grid with search, date filter (upcoming/week/month/all), category pills |
| `frontend/src/app/(app)/events/[id]/page.tsx` ✦ | Event detail: RSVP · waitlist join · cancel registration · check-in badge |
| `frontend/src/app/(app)/events/new/page.tsx` ✦ | Officer event creation form — all fields, submits as `PENDING_APPROVAL` |
| `frontend/src/app/(app)/events/[id]/manage/page.tsx` ✦ | Attendee list + check-in toggle per person + stats panel + cancel event |
| `frontend/src/app/(app)/clubs/[slug]/page.tsx` | Replaced events placeholder with live upcoming events from the club |

### Phase 4 — Role-Based Dashboards

| File | Purpose |
|---|---|
| `backend/src/controllers/userController.ts` | Added `getMyClubs` handler |
| `backend/src/routes/users.ts` | Added `GET /users/me/clubs` |
| `backend/src/controllers/adminController.ts` ✦ | `getAdminStats` — pending counts, pending club/event lists, recent activity feed |
| `backend/src/routes/admin.ts` ✦ | `GET /admin/stats` (admin-only RBAC) |
| `backend/src/index.ts` | Mounts `/admin` |
| `frontend/src/lib/auth.ts` | Added `MyClub` type + `getMyClubs()` function |
| `frontend/src/lib/admin.ts` ✦ | `AdminStats` type + `getAdminStats()` function |
| `frontend/src/app/(app)/dashboard/page.tsx` | Full rewrite — three role-specific dashboards (Student / Officer / Admin) |

### Phase 5 — Venue & Resource Booking

| File | Purpose |
|---|---|
| `backend/prisma/schema.prisma` | Added `Venue`, `VenueBooking`, `Resource`, `ResourceBooking`, `BookingStatus` enum |
| `backend/src/controllers/venueController.ts` ✦ | listVenues, getVenue, getVenueAvailability, createVenueBooking, getMyVenueBookings, getAllVenueBookings, approve/reject/cancel, createVenue, updateVenue |
| `backend/src/controllers/resourceController.ts` ✦ | listResources, createResourceBooking, getMyResourceBookings, getAllResourceBookings, approve/reject/cancel, createResource, updateResource |
| `backend/src/routes/venues.ts` ✦ | All venue routes with auth/RBAC middleware |
| `backend/src/routes/resources.ts` ✦ | All resource routes with auth/RBAC middleware |
| `backend/src/index.ts` | Mounts `/venues` and `/resources` |
| `backend/src/controllers/adminController.ts` | Extended with `pendingVenueBookings` + `pendingResourceBookings` counts + lists |
| `frontend/src/lib/venues.ts` ✦ | Types + all API functions for venues and resources |
| `frontend/src/lib/admin.ts` | Extended `AdminStats` with booking counts + lists |
| `frontend/src/app/(app)/venues/page.tsx` ✦ | Venue directory with search + admin "Add Venue" modal |
| `frontend/src/app/(app)/venues/[id]/page.tsx` ✦ | Venue detail + inline booking form + upcoming bookings panel |
| `frontend/src/app/(app)/resources/page.tsx` ✦ | Resource listing with category filter + booking modal per resource |
| `frontend/src/app/(app)/my-bookings/page.tsx` ✦ | Tabbed page: venue bookings + resource bookings with status + cancel |
| `frontend/src/components/layout/AppShell.tsx` | Added Venues, Resources, My Bookings nav items |
| `frontend/src/app/(app)/dashboard/page.tsx` | Admin dashboard: 2 new stat cards + pending venue/resource booking approval sections |

### Phase 6 — Communication & Notifications

| File | Purpose |
|---|---|
| `backend/prisma/schema.prisma` | Added `Notification`, `Announcement`, `NotificationPreference` models; `NotificationType` enum |
| `backend/src/services/notificationService.ts` ✦ | `createNotification` + `createBulkNotifications` — fire-and-forget, respects user preferences |
| `backend/src/controllers/notificationController.ts` ✦ | `listNotifications`, `markRead`, `markAllRead`, `deleteNotification` |
| `backend/src/controllers/announcementController.ts` ✦ | `listAnnouncements`, `createAnnouncement`, `updateAnnouncement`, `deleteAnnouncement` |
| `backend/src/routes/notifications.ts` ✦ | All notification routes |
| `backend/src/routes/announcements.ts` ✦ | All announcement routes (`optionalAuth` on GET) |
| `backend/src/controllers/userController.ts` | Added `getNotificationPreferences`, `updateNotificationPreferences` |
| `backend/src/routes/users.ts` | Added `GET/PUT /users/me/notification-preferences` |
| `backend/src/controllers/eventController.ts` | Notification triggers: RSVP, approve, reject, cancel (bulk to attendees), waitlist promotion |
| `backend/src/controllers/clubController.ts` | Notification triggers: club approve/reject, membership approve/reject |
| `backend/src/controllers/venueController.ts` | Notification triggers: booking approve/reject |
| `backend/src/controllers/resourceController.ts` | Notification triggers: booking approve/reject |
| `backend/src/index.ts` | Mounts `/notifications` and `/announcements` |
| `frontend/src/lib/notifications.ts` ✦ | All types + API functions for notifications, preferences, and announcements |
| `frontend/src/components/shared/NotificationBell.tsx` ✦ | Bell icon with unread badge, dropdown panel, mark-read on click, 30s polling |
| `frontend/src/components/layout/AppShell.tsx` | Bell added to sidebar header + mobile topbar; Announcements + Settings nav items added |
| `frontend/src/app/(app)/notifications/page.tsx` ✦ | Full notification list: mark-read per item, mark-all-read, delete |
| `frontend/src/app/(app)/settings/notifications/page.tsx` ✦ | Toggle-based preference form: event / club / booking / announcement categories |
| `frontend/src/app/(app)/announcements/page.tsx` ✦ | Announcements feed + create modal (priority, global vs club audience) for officers/admins |
| `frontend/src/app/(app)/dashboard/page.tsx` | Added shared `AnnouncementsFeed` component injected into all 3 dashboards |

### Phase 7 — Feedback & Analytics

| File | Purpose |
|---|---|
| `backend/prisma/schema.prisma` | Added `EventFeedback` model + relations on `User` and `Event` |
| `backend/src/controllers/feedbackController.ts` ✦ | `submitFeedback`, `getMyFeedback`, `getEventFeedback` |
| `backend/src/controllers/analyticsController.ts` ✦ | `getClubAnalytics`, `getAdminAnalytics` |
| `backend/src/routes/events.ts` | Added `POST/GET /:id/feedback` and `GET /:id/feedback/mine` |
| `backend/src/routes/clubs.ts` | Added `GET /:id/analytics` |
| `backend/src/routes/admin.ts` | Added `GET /analytics`; refactored to `adminOnly` middleware array |
| `frontend/src/lib/analytics.ts` ✦ | All types + API functions for feedback, club analytics, admin analytics |
| `frontend/src/app/(app)/events/[id]/page.tsx` | Added post-event feedback form (star rating + category sub-ratings + comment); officer "View Feedback" link; `getMyFeedback` query to prevent duplicate submissions |
| `frontend/src/app/(app)/events/[id]/feedback/page.tsx` ✦ | Officer feedback report: avg rating, distribution bars, category averages, individual responses list |
| `frontend/src/app/(app)/clubs/[slug]/analytics/page.tsx` ✦ | Club analytics: 6 stat cards, member growth bar chart, events-by-status bar chart, top events table (Recharts) |
| `frontend/src/app/(app)/analytics/page.tsx` ✦ | Admin analytics dashboard: 6 overview cards, user growth + event growth charts, events/clubs by category (horizontal bar), top clubs + top events tables (Recharts) |
| `frontend/src/app/(app)/clubs/[slug]/manage/page.tsx` | Added Analytics button in page header |
| `frontend/src/components/layout/AppShell.tsx` | Added Analytics nav item (visible to UNIVERSITY_ADMIN and SYSTEM_ADMIN only) |

### Phase 8 — Admin Panel

| File | Purpose |
|---|---|
| `backend/prisma/schema.prisma` | Added `ContentReport`, `SystemConfig` models; `ReportStatus` enum; `contentReportsSubmitted`/`contentReportsResolved` relations on `User` |
| `backend/src/controllers/adminController.ts` | Added `listAdminUsers`, `suspendUser`, `activateUser`, `changeUserRole`, `listAdminClubs`, `listAdminEvents`, `listContentReports`, `resolveContentReport`, `dismissContentReport`, `getSystemSettings`, `upsertSystemSetting` |
| `backend/src/controllers/contentController.ts` ✦ | `submitContentReport` — any authenticated user can report content |
| `backend/src/routes/admin.ts` | Added all Phase 8 admin routes (users, clubs, events, content-reports, settings) |
| `backend/src/routes/content.ts` ✦ | `POST /content/report` — user-facing reporting route |
| `backend/src/index.ts` | Mounts `/content` |
| `frontend/src/lib/admin.ts` | Extended with all Phase 8 types + API functions (`listAdminUsers`, `suspendUser`, `activateUser`, `changeUserRole`, `listAdminClubs`, `listAdminEvents`, `listContentReports`, `resolveContentReport`, `dismissContentReport`, `getSystemSettings`, `upsertSystemSetting`, `submitContentReport`) |
| `frontend/src/app/(app)/admin/page.tsx` ✦ | Admin panel home: quick-stats cards + 6 section navigation cards |
| `frontend/src/app/(app)/admin/users/page.tsx` ✦ | User management: paginated table, search/role/status filters, suspend modal, change-role modal |
| `frontend/src/app/(app)/admin/clubs/page.tsx` ✦ | Club oversight: paginated table, search/status filters, external link to club profile |
| `frontend/src/app/(app)/admin/events/page.tsx` ✦ | Event oversight: paginated table, search/status filters, external link to event detail |
| `frontend/src/app/(app)/admin/content-reports/page.tsx` ✦ | Content moderation queue: status-tab filter, resolve/dismiss actions with admin note modal |
| `frontend/src/app/(app)/admin/settings/page.tsx` ✦ | System settings: inline edit for well-known keys, add custom key/value pairs |
| `frontend/src/components/shared/ReportContentButton.tsx` ✦ | Reusable "Report" button + modal (reason picker + description) for events and clubs |
| `frontend/src/app/(app)/events/[id]/page.tsx` | Added `ReportContentButton` at bottom of event detail (visible to authenticated users) |
| `frontend/src/app/(app)/clubs/[slug]/page.tsx` | Added `ReportContentButton` at bottom of club profile (visible to authenticated users) |
| `frontend/src/components/layout/AppShell.tsx` | Added "Admin Panel" nav item (visible to UNIVERSITY_ADMIN and SYSTEM_ADMIN only) |

### Phase 10 — Reporting & Export

| File | Purpose |
|---|---|
| `backend/prisma/schema.prisma` | New model `Report` (type, format, name, params Json, generatedById). `reports` relation added to `User` |
| `backend/src/controllers/reportController.ts` ✦ | `listReports`, `generateReport` (streams CSV/PDF + saves metadata), `downloadReport` (re-generates by saved params), `deleteReport`. PDF via PDFKit; CSV built in-memory. Four report types: MEMBERS, ATTENDANCE, EVENTS, SYSTEM |
| `backend/src/routes/reports.ts` ✦ | `GET /reports`, `POST /reports/generate`, `GET /reports/:id/download`, `DELETE /reports/:id` — all admin-only |
| `backend/src/index.ts` | Mounts `/reports` |
| `frontend/src/lib/reports.ts` ✦ | `listReports`, `generateReport` (streams blob → browser download), `downloadReport`, `deleteReport`. Uses native `fetch` with `responseType: blob` for file streaming |
| `frontend/src/app/(app)/admin/reports/page.tsx` ✦ | Reports page: 4-type card selector (MEMBERS/ATTENDANCE/EVENTS/SYSTEM), format toggle (CSV/PDF), club/event dropdown selectors, generate+download button, report history table with re-download + delete |
| `frontend/src/app/(app)/admin/page.tsx` | Added "Reports & Export" navigation card (teal) to admin panel home |
| `frontend/src/components/layout/AppShell.tsx` | Added "Reports" nav item (admin-only, FileText icon); `NavItem.exact` field added to prevent `/admin` highlighting on sub-routes |
| `frontend/src/app/(app)/events/[id]/manage/page.tsx` | Added CSV + PDF export buttons in AttendeesTab stats row — triggers ATTENDANCE report download |
| `frontend/src/app/(app)/clubs/[slug]/manage/page.tsx` | Added CSV + PDF export buttons above approved member list in MembersTab — triggers MEMBERS report download |

### Phase 9 — Search & Security Enhancements

| File | Purpose |
|---|---|
| `backend/prisma/schema.prisma` | `User`: `loginAttempts`, `lockedUntil`, `sessions` relation. New model `Session` (tokenHash, userAgent, ipAddress, expiresAt) |
| `backend/src/controllers/authController.ts` | Added login attempt tracking + 15-min lockout after 5 failures; `logout` endpoint; session creation on login + rotation on refresh; `resendVerification`; `getSessions`, `revokeSession`, `revokeAllSessions` |
| `backend/src/controllers/searchController.ts` ✦ | `globalSearch` (ILIKE across clubs/events/announcements), `getRecommendations` (personalized events by user interests) |
| `backend/src/routes/auth.ts` | Added `express-rate-limit` on login (10/15 min) + other auth routes (20/15 min); logout, resend-verification, sessions endpoints |
| `backend/src/routes/search.ts` ✦ | `GET /search?q=&type=`, `GET /search/recommendations` |
| `backend/src/index.ts` | Mounts `/search` |
| `frontend/src/lib/search.ts` ✦ | Types + API functions: `globalSearch`, `getRecommendations`, `getSessions`, `revokeSession`, `revokeAllSessions`, `resendVerification` |
| `frontend/src/components/shared/GlobalSearchBar.tsx` ✦ | Debounced inline search with dropdown preview (top 3 per category) + "See all" links to `/search` |
| `frontend/src/components/layout/AppShell.tsx` | Added `GlobalSearchBar` between logo and nav; added "Sessions" nav item |
| `frontend/src/app/(app)/search/page.tsx` ✦ | Full search results page: query bar, All/Clubs/Events/Announcements tabs, result cards per type |
| `frontend/src/app/(app)/settings/sessions/page.tsx` ✦ | Active sessions list: device/IP/timestamp per session, revoke individual session, revoke-all with confirmation |
| `frontend/src/app/(app)/dashboard/page.tsx` | Student dashboard now uses `getRecommendations()` instead of `listEvents()` — shows "Based on your interests" subtitle when personalized |

✦ = created new (not previously existing)

---

## Backend API — All Endpoints

```
POST   /auth/register                       rate-limited (20/15 min)
POST   /auth/login                          rate-limited (10/15 min); tracks loginAttempts; locks account 15 min after 5 failures
POST   /auth/logout                         clears session + User.refreshToken
POST   /auth/refresh-token                  rotates Session.tokenHash + User.refreshToken
GET    /auth/me                             auth
POST   /auth/request-password-reset        rate-limited
POST   /auth/reset-password                rate-limited
GET    /auth/verify-email
POST   /auth/resend-verification            rate-limited — re-sends email verification link (UC-11.1)
GET    /auth/sessions                       auth — list active sessions for current user (UC-8.3)
DELETE /auth/sessions/all                   auth — revoke all sessions + clear refresh token (force logout everywhere)
DELETE /auth/sessions/:id                   auth — revoke a specific session

GET    /users/me                            auth — full profile from DB
PUT    /users/me                            auth — update name, department, year, interests, avatarUrl
GET    /users/me/history                    auth — upcoming + past event attendances, clubs created
GET    /users/me/clubs                      auth — clubs user belongs to (role, memberCount, pendingCount)
GET    /users/me/notification-preferences   auth — get prefs; upserts defaults on first call
PUT    /users/me/notification-preferences   auth — update eventUpdates/clubUpdates/bookingUpdates/announcements

GET    /clubs                               optionalAuth — active list + search + category filter
GET    /clubs/:slugOrId                     optionalAuth — club profile; myMembership injected when logged in
POST   /clubs                               auth — request club creation (status PENDING)
PUT    /clubs/:id                           auth — officer updates club info
POST   /clubs/:id/approve                   admin only → status ACTIVE, creator becomes PRESIDENT + CLUB_OFFICER
POST   /clubs/:id/reject                    admin only (body: { note? })
DELETE /clubs/:id                           admin only — sets status INACTIVE
GET    /clubs/:id/members                   auth — officer sees all statuses; others see APPROVED only
POST   /clubs/:id/members/request           auth — request membership (re-request if previously REJECTED)
POST   /clubs/:id/members/:userId/approve   auth — officer
POST   /clubs/:id/members/:userId/reject    auth — officer
PUT    /clubs/:id/members/:userId/role      auth — president only; promotes STUDENT → CLUB_OFFICER
DELETE /clubs/:id/members/:userId           auth — self-leave or officer remove; last-president guard enforced

GET    /events                              optionalAuth — APPROVED only publicly; admins see all statuses
GET    /events/me/registrations             auth — my active REGISTERED attendances
GET    /events/:id                          optionalAuth — event detail + myRegistration + waitlistCount
POST   /events                              auth — club officer; status PENDING_APPROVAL
PUT    /events/:id                          auth — club officer
DELETE /events/:id                          auth — club officer; sets status CANCELLED
POST   /events/:id/approve                  admin only
POST   /events/:id/reject                   admin only (body: { note? })
POST   /events/:id/register                 auth — RSVP; auto-waitlists if at capacity
DELETE /events/:id/register                 auth — cancel; promotes next waitlisted automatically
GET    /events/:id/attendees                auth — club officer
POST   /events/:id/checkin/:userId          auth — club officer; toggles checkedIn / checkedInAt

GET    /admin/stats                         admin only — pending counts + lists + recent activity feed

GET    /venues                              optionalAuth — active venues + search
GET    /venues/bookings/mine                auth — my venue bookings
GET    /venues/bookings                     admin — all bookings (optional ?status= filter)
GET    /venues/:id                          optionalAuth — venue detail + approved bookings
GET    /venues/:id/availability             optionalAuth — approved bookings on ?date=YYYY-MM-DD
POST   /venues/:id/book                     auth — request booking (conflict-checked at request time too)
POST   /venues/bookings/:id/approve         admin — approve (re-checks conflicts)
POST   /venues/bookings/:id/reject          admin (body: { note? })
DELETE /venues/bookings/:id                 auth — requester or admin; sets CANCELLED
POST   /venues                              admin — create venue
PUT    /venues/:id                          admin — update venue / toggle isActive

GET    /resources                           optionalAuth — active resources + category filter
GET    /resources/bookings/mine             auth — my resource bookings
GET    /resources/bookings                  admin — all bookings (optional ?status= filter)
POST   /resources/:id/book                  auth — request booking with quantity
POST   /resources/bookings/:id/approve      admin — approve (checks available quantity for time window)
POST   /resources/bookings/:id/reject       admin (body: { note? })
DELETE /resources/bookings/:id              auth — requester or admin; sets CANCELLED
POST   /resources                           admin — create resource
PUT    /resources/:id                        admin — update resource / toggle isActive

GET    /notifications                       auth — latest 50 notifications + unreadCount
PUT    /notifications/read-all              auth — mark all unread as read
PUT    /notifications/:id/read              auth — mark single notification as read
DELETE /notifications/:id                   auth — delete notification

GET    /announcements                       optionalAuth — global + user's club announcements (publishedAt ≤ now)
POST   /announcements                       auth — admin: global; officer: club-specific
PUT    /announcements/:id                   auth — creator or admin
DELETE /announcements/:id                   auth — creator or admin

POST   /events/:id/feedback                 auth — submit feedback; event must be ended; user must be registered; one per user
GET    /events/:id/feedback                 auth — club officer/admin: all feedback + aggregate stats
GET    /events/:id/feedback/mine            auth — user's own feedback for the event (null if not yet submitted)

GET    /clubs/:id/analytics                 auth — club officer/admin: member growth, event stats, attendance, feedback avg
GET    /admin/analytics                     admin only — system-wide: user growth, event growth, category breakdowns, top clubs/events

GET    /admin/users                         admin — list all users; ?q= ?role= ?suspended= ?page= ?limit=
PUT    /admin/users/:id/suspend             admin — suspend user (body: { reason? })
PUT    /admin/users/:id/activate            admin — un-suspend user
PUT    /admin/users/:id/role               admin — change system role (body: { role })

GET    /admin/clubs                         admin — list all clubs (all statuses); ?q= ?status= ?page= ?limit=
GET    /admin/events                        admin — list all events (all statuses); ?q= ?status= ?page= ?limit=

GET    /admin/content-reports               admin — list content reports; ?status= ?page= ?limit=
PUT    /admin/content-reports/:id/resolve   admin — mark resolved (body: { note? })
PUT    /admin/content-reports/:id/dismiss   admin — mark dismissed (body: { note? })

GET    /admin/settings                      admin — get all SystemConfig entries as list + key→value map
PUT    /admin/settings                      admin — upsert a setting (body: { key, value, label? })

POST   /content/report                      auth — submit content report (body: { targetType, targetId, reason, description? })

GET    /search                              optionalAuth — ?q= ?type=all|clubs|events|announcements; ILIKE across active clubs, approved events, published announcements
GET    /search/recommendations              auth — personalized upcoming events matched to user.interests; falls back to general upcoming if no interests or no matches

GET    /reports                             admin — list past generated reports (newest first, up to 100)
POST   /reports/generate                    admin — generate report and stream file; saves metadata to DB (body: { type, format, clubId?, eventId? })
GET    /reports/:id/download                admin — re-download a past report by regenerating from saved params
DELETE /reports/:id                         admin — delete report metadata record
```

---

## Key Business Logic

1. **Club approval:** Admin approves → status `ACTIVE` + creator gets `ClubMembership(PRESIDENT, APPROVED)` + system role upgraded to `CLUB_OFFICER`.
2. **Role promotion:** Promoting a member to COORDINATOR or PRESIDENT also upgrades their system `Role` to `CLUB_OFFICER`.
3. **Last president guard:** A member cannot leave or be removed if they are the sole remaining PRESIDENT of a club.
4. **Membership re-request:** A REJECTED membership is reset to PENDING on re-request rather than creating a duplicate row.
5. **Slug generation:** `generateSlug()` lowercases + replaces non-alphanumeric chars with `-`; `uniqueSlug()` appends `-1`, `-2`, etc. on collision. `getClub` accepts both UUID and slug.
6. **Event approval flow:** Officers create events as `PENDING_APPROVAL`; only admins can move to `APPROVED` or `REJECTED`. Officers can cancel (→ `CANCELLED`) but cannot hard-delete.
7. **Waitlist:** Confirmed spots = `status=REGISTERED, isWaitlisted=false`. When a confirmed attendee cancels, the earliest waitlisted record is automatically promoted (`isWaitlisted → false`).
8. **Check-in toggle:** `POST /events/:id/checkin/:userId` flips `checkedIn`; if un-checking, `checkedInAt` is set back to `null`.
9. **Dashboard routing:** `dashboard/page.tsx` reads `user.role` from localStorage and renders `StudentDashboard`, `OfficerDashboard`, or `AdminDashboard` — no extra server round-trip needed.
10. **Admin inline actions:** The admin dashboard approve/reject buttons use optimistic UI — items are removed from local state immediately and counts decremented without a page reload.
11. **Notification fire-and-forget:** All `createNotification`/`createBulkNotifications` calls are prefixed with `void` — errors are silently swallowed so they never break the calling request.
12. **Notification preferences gate:** Before inserting, `notificationService` looks up `NotificationPreference` for the user. If the relevant category pref is `false`, the notification is skipped. Row is auto-created with all defaults `true` on first `GET /users/me/notification-preferences` call (via upsert).
13. **Announcement audience:** Global announcements (`clubId = null`) are visible to all users. Club-specific announcements are visible only to approved members of that club. `publishedAt ≤ now` filters out future-scheduled items.
14. **Notification bell (real-time):** `NotificationBell` does a single fetch on mount, then listens for `notification:new` socket events. No more `setInterval` polling. Clicking a notification marks it read and navigates to its `link`. "Mark all read" fires `PUT /notifications/read-all`.
15. **AnnouncementsFeed on dashboard:** All three dashboards show the top 3 announcements. The component returns `null` when the list is empty so no empty card is rendered.
16. **Venue booking conflict check:** Applied at request time (soft check, warns but allows) and again at admin approve time (hard block if a conflicting APPROVED booking exists).
17. **Resource quantity check:** On approve, sums quantity of all overlapping APPROVED bookings for the same resource and blocks if `requested > available`.
18. **Feedback eligibility:** `POST /events/:id/feedback` requires: event status = `APPROVED`, event has ended (`endsAt < now`, or `startsAt < now` if no `endsAt`), user has a `REGISTERED` `EventAttendance` record. DB unique constraint on `[eventId, userId]` enforces one submission per user.
19. **Feedback form on event detail:** The form renders only when all three conditions are met: event ended, user is authenticated, `myRegistration.status === "REGISTERED"`. A pre-fetch of `GET /events/:id/feedback/mine` (enabled only when conditions are met) determines whether to show the form or a "submitted" confirmation card.
20. **Analytics monthly grouping:** Both `getClubAnalytics` and `getAdminAnalytics` compute the last 6 calendar months in JS (not raw SQL) and group fetched records client-side. Simple and avoids DB-specific date functions.
21. **Analytics nav gating:** The "Analytics" nav item in AppShell is only injected for `UNIVERSITY_ADMIN` and `SYSTEM_ADMIN` roles. Club officers access club analytics via the Analytics button on their club manage page.
22. **Recharts SSR guard:** All chart pages use `useState(false)` + `useEffect(() => setMounted(true), [])`. Charts render only after mount to avoid SSR issues with `ResizeObserver` and other browser APIs used by recharts.
23. **Admin user pagination:** `GET /admin/users` supports `page`, `limit` (max 100), `q` (name/email ILIKE), `role`, and `suspended` filters. All admin list endpoints follow the same `{ data, total, page, limit, pages }` shape.
24. **Suspend guard:** Admins cannot suspend themselves or a SYSTEM_ADMIN (unless the actor is also SYSTEM_ADMIN). `activateUser` clears both `isSuspended` and `suspendedReason`.
25. **Role change guard:** Admins cannot change their own role. Only SYSTEM_ADMIN can change another SYSTEM_ADMIN's role.
26. **Content report flow:** Any authenticated user posts `POST /content/report` → stored as `PENDING`. Admins resolve or dismiss from `/admin/content-reports` with an optional note. Target types: `EVENT`, `CLUB`, `ANNOUNCEMENT`, `USER`. Users cannot report themselves.
27. **System config upsert:** `PUT /admin/settings` upserts by `key` (unique). The `label` field is a human-readable display name shown in the settings UI. Well-known keys (6 defaults) are always shown; any additional keys appear in a "Custom Settings" section.
28. **Admin Panel nav gating:** The "Admin Panel" nav item in AppShell is only injected for `UNIVERSITY_ADMIN` and `SYSTEM_ADMIN`, same as Analytics.
29. **ReportContentButton:** Shared component used on event detail and club profile pages. Renders a small "Report" link that opens a modal. After successful submission, shows a confirmation card instead of the form.
30. **Login attempt tracking:** Failed login increments `User.loginAttempts`. After 5 failures the account is locked (`lockedUntil = now + 15 min`). The remaining lock time is returned in the 423 error message. A successful login resets both fields to 0/null.
31. **Session tracking:** Every successful login creates a `Session` row (tokenHash = bcrypt of refresh token, userAgent, IP, expiresAt). `GET /auth/sessions` returns non-expired sessions. Refresh rotates the tokenHash in the matching Session. `DELETE /auth/sessions/:id` revokes one session; `DELETE /auth/sessions/all` deletes all sessions + clears `User.refreshToken` (equivalent to "log out everywhere"). The front-end `/settings/sessions` page lets users view devices and revoke sessions, with a "Sign out all" confirmation flow that also clears local storage.
32. **Rate limiting:** Auth routes use `express-rate-limit` — login is capped at 10 requests per 15-minute window per IP; register, refresh, resend-verification, and password-reset routes are capped at 20. `standardHeaders: true` sends `RateLimit-*` headers; legacy `X-RateLimit-*` headers are suppressed.
33. **Global search:** `GET /search?q=&type=` runs Prisma `contains` queries (case-insensitive) across clubs (name/description/category/tags), events (title/description/location/category — APPROVED only), and announcements (title/content — publishedAt ≤ now). Returns up to 10 results per category. The `GlobalSearchBar` component debounces 350 ms, shows a live dropdown with up to 3 hits per section, and links to the `/search` full-results page.
34. **Recommendations:** `GET /search/recommendations` matches the user's `interests[]` array against event `category` (case-insensitive `in` filter). If no interests are set or no category matches exist, falls back to the next 6 upcoming APPROVED events. The student dashboard shows a "Based on your interests" subtitle only when `isPersonalized: true` is returned.
35. **Resend verification (UC-11.1):** `POST /auth/resend-verification` generates a new token and sends a new verification email. Always returns 200 regardless of whether the email exists or is already verified, to avoid leaking account info.
36. **Report generation (UC-10.1):** `POST /reports/generate` accepts `{ type, format, clubId?, eventId? }`. The file is streamed directly to the response (no disk storage). Metadata (type, format, name, params, generatedBy) is saved to the `Report` model for history. `GET /reports/:id/download` re-generates the same file on demand using the stored params.
37. **Report types:** MEMBERS (approved club members — requires `clubId`), ATTENDANCE (event attendees + check-in status — requires `eventId`), EVENTS (all events system-wide, up to 500, no extra params), SYSTEM (platform-wide metrics as key/value pairs).
38. **CSV format:** Built as a plain string with RFC-compliant escaping (values containing commas, quotes, or newlines are double-quote-wrapped). No external package — keeps the dependency tree light.
39. **PDF format:** Uses PDFKit. PDFs are streamed via `doc.pipe(res)` — no temp files needed. Events report uses landscape A4; all others use portrait A4. Alternating row shading applied for readability.
40. **Export from data tables:** Event manage page (Attendees tab) and Club manage page (Members tab) both have inline CSV + PDF export buttons that call `generateReport` client-side and trigger a browser download immediately, without navigating away.
41. **Admin nav exact-match:** The `NavItem` type gained an `exact?: boolean` field. The "Admin Panel" item sets `exact: true` so it is not highlighted as active when the user is on `/admin/reports` or other sub-routes.

---

## Upgrade Phases

All 12 upgrade phases are detailed in `upgradePlan.md`. Summary of completed upgrade phases:

### Phase U1 — UI Polish & Micro-interactions ✅ (2026-06-07)

**What was done:**
- **Sonner toast system** — `<Toaster richColors position="top-right" closeButton />` mounted in root `layout.tsx`. `toast.success()` / `toast.error()` wired into profile edit, event creation, and club creation forms. All inline `{apiError && ...}` / `{success && ...}` banners replaced with toasts.
- **Framer Motion stagger animations** — `events/page.tsx` and `clubs/page.tsx` grids now use `variants={{ hidden, show }}` with `staggerChildren: 0.06` — cards animate in sequentially on load. Dashboard stat cards use individual `initial/animate` with staggered delays.
- **Skeleton loaders** — `Skeleton.tsx` extended with `SkeletonEventCard`, `SkeletonClubCard`, `SkeletonListRow` variants (dark-mode aware). Events page, clubs page, and notifications page now use specific skeleton shapes instead of generic pulsing blocks.
- **EmptyState component** — Rewrote to accept `icon: LucideIcon`, `action: { label, href }`, and `onAction` props. Styled with a soft background circle behind the icon. Events, clubs, and notifications pages use the new component.
- **Mobile bottom navigation** — New `frontend/src/components/layout/BottomNav.tsx` — 5-tab bar (Home, Events, Clubs, Alerts, Profile) with active indicator, notification badge dot, dark mode support. Mounted in `(app)/layout.tsx` with `pb-16 md:pb-0` on the main content div so nothing hides behind it.
- **Dark mode** — Extended `globals.css` with `.bg-\[\#FAFAFA\]` dark override, dark mode on new skeleton variants.
- **CommandPalette fix** — Fixed `data.clubs` → `data.results.clubs` to match actual `SearchResults` type shape.
- **PageTransition + CommandPalette** — Already wired in `(app)/layout.tsx` from prior phases; verified still working.

**Files modified:**
| File | Change |
|---|---|
| `frontend/src/app/layout.tsx` | Add `<Toaster>` |
| `frontend/src/app/(app)/layout.tsx` | Add `<BottomNav>` + `pb-16 md:pb-0` wrapper |
| `frontend/src/app/globals.css` | Dark mode for `#FAFAFA`, page fade class |
| `frontend/src/components/shared/Skeleton.tsx` | Add `SkeletonEventCard`, `SkeletonClubCard`, `SkeletonListRow` |
| `frontend/src/components/shared/EmptyState.tsx` | Rewrite with `icon` prop + action button |
| `frontend/src/components/shared/CommandPalette.tsx` | Fix `data.clubs` → `data.results.clubs` |
| `frontend/src/components/layout/BottomNav.tsx` ✦ | New mobile bottom nav |
| `frontend/src/app/(app)/events/page.tsx` | Motion stagger grid, proper skeletons, EmptyState |
| `frontend/src/app/(app)/clubs/page.tsx` | Motion stagger grid, proper skeletons, EmptyState |
| `frontend/src/app/(app)/dashboard/page.tsx` | Motion on stat cards (all 3 dashboards) |
| `frontend/src/app/(app)/profile/page.tsx` | Sonner toasts, remove inline success/error state |
| `frontend/src/app/(app)/events/new/page.tsx` | Sonner toasts, remove inline error state |
| `frontend/src/app/(app)/clubs/new/page.tsx` | Sonner toasts, remove inline error state |
| `frontend/src/app/(app)/notifications/page.tsx` | Proper skeletons, shared EmptyState |

---

### Phase U2 — Real-Time Layer (Socket.io) ✅ (2026-06-07)

**What was done:**
- **Socket.io server** — `backend/src/index.ts` rewritten to use `http.createServer`. A `SocketServer` is attached with CORS matching allowed origins. Middleware authenticates the JWT from `handshake.auth.token` and attaches `userId` + `role` to `socket.data`. On connection each socket auto-joins `user:{userId}`; admins also join `admin`. Clients can emit `join:event` / `leave:event` to enter/exit per-event rooms.
- **Backend socket helpers** — `backend/src/lib/socket.ts` (new): `emitToUser`, `emitToEvent`, `emitToAdmin` wrapper functions. Imported by controllers via the `io` singleton exported from `index.ts`.
- **Server-side emits added:**
  - `notificationService.createNotification` → emits `notification:new` to `user:{userId}` after DB insert
  - `notificationService.createBulkNotifications` → emits `notification:new` to each target user
  - `eventController.registerForEvent` / `cancelRegistration` → emits `event:attendance_changed` (registeredCount, waitlistCount) to `event:{id}`
  - `eventController.checkInUser` → emits `event:checkin` (userId, checkedIn, checkedInAt) to `event:{id}`
  - `eventController.createEvent` → emits `admin:new_pending` (type: "event", id, title) to `admin`
  - `clubController.createClub` → emits `admin:new_pending` (type: "club", id, title) to `admin`
- **Frontend socket singleton** — `frontend/src/lib/socket.ts` (new): `getSocket(token)` returns/creates a single `Socket` instance. `disconnectSocket()` tears it down. Uses `NEXT_PUBLIC_SOCKET_URL` env var.
- **`useSocket` hook** — `frontend/src/hooks/useSocket.ts` (new): Returns the shared socket, initializing it with the current user's `accessToken` from localStorage on first call.
- **NotificationBell** — Removed `setInterval` (30s polling). Now: initial fetch on mount + `socket.on("notification:new", ...)` listener. Optimistically prepends new notification to the dropdown and increments the badge.
- **Event detail page** (`events/[id]/page.tsx`) — Joins `event:{id}` room on mount, leaves on unmount. Listens for `event:attendance_changed` to update the confirmed and waitlist counts live without a refetch.
- **Event manage page** (`events/[id]/manage/page.tsx`) — Joins `event:{id}` room on mount, leaves on unmount. Listens for `event:checkin` and calls `queryClient.invalidateQueries` to auto-refresh the attendee list when any check-in occurs (from another terminal/tab).
- **Admin dashboard** — `AdminDashboard` in `dashboard/page.tsx` listens for `admin:new_pending` and shows a `toast.info(...)` with the item title, then increments the relevant pending counter live.
- **`NEXT_PUBLIC_SOCKET_URL`** — Added to `frontend/.env.local` (value: `http://127.0.0.1:5001`).
- **Bug fix** — `useSocket.ts`: corrected `getAuthState()?.accessToken` → `getAuthState()?.tokens.accessToken` (token is nested under `.tokens`).

**Files created/modified:**
| File | Change |
|---|---|
| `backend/src/index.ts` | Rewrite: `http.createServer` + `SocketServer` with JWT middleware, room joins |
| `backend/src/lib/socket.ts` ✦ | New: `emitToUser`, `emitToEvent`, `emitToAdmin` helpers |
| `backend/src/services/notificationService.ts` | Emit `notification:new` after every notification insert |
| `backend/src/controllers/eventController.ts` | Emit `event:attendance_changed` on RSVP/cancel; `event:checkin` on check-in; `admin:new_pending` on create |
| `backend/src/controllers/clubController.ts` | Emit `admin:new_pending` on club creation |
| `frontend/src/lib/socket.ts` ✦ | New: singleton `Socket` client, `getSocket`, `disconnectSocket` |
| `frontend/src/hooks/useSocket.ts` ✦ | New: `useSocket()` hook, `useSocketDisconnect()` hook |
| `frontend/.env.local` | Add `NEXT_PUBLIC_SOCKET_URL` |
| `frontend/src/components/shared/NotificationBell.tsx` | Replace `setInterval` polling with `socket.on("notification:new")` |
| `frontend/src/app/(app)/events/[id]/page.tsx` | Join event room; listen for `event:attendance_changed` → live counts |
| `frontend/src/app/(app)/events/[id]/manage/page.tsx` | Join event room; listen for `event:checkin` → auto-refresh attendee list |
| `frontend/src/app/(app)/dashboard/page.tsx` | `AdminDashboard`: listen for `admin:new_pending` → toast + increment pending counters |

**Socket events reference:**
| Event | Direction | Room | Payload |
|---|---|---|---|
| `notification:new` | server→client | `user:{userId}` | Full `Notification` object |
| `event:attendance_changed` | server→client | `event:{eventId}` | `{ registeredCount, waitlistCount }` |
| `event:checkin` | server→client | `event:{eventId}` | `{ userId, checkedIn, checkedInAt }` |
| `admin:new_pending` | server→client | `admin` | `{ type: "event"\|"club", id, title }` |
| `join:event` | client→server | — | `eventId: string` |
| `leave:event` | client→server | — | `eventId: string` |

---

### Phase U3 — File Uploads + Rich Text Editor ✅ (2026-06-07)

**What was done:**

- **Backend upload endpoint** — `POST /uploads?type=<avatar|poster|banner|logo>` — auth required. Uses `multer` (memory storage) + `sharp` to resize/convert images to WebP and save to `backend/public/uploads/<type>/`. Serves files statically via `express.static` at `/uploads`. Helmet `crossOriginResourcePolicy` set to `cross-origin` so Next.js can load images from the backend origin.
- **`FileUpload` component** — `frontend/src/components/shared/FileUpload.tsx` — drag-and-drop + click-to-upload zone. Avatar type renders as a circle with hover overlay. All other types render as a rectangle with appropriate aspect ratio. Shows upload progress spinner, image preview, and "Remove" button. Posts `FormData` to `/uploads` with the user's `accessToken`.
- **`RichTextEditor` component** — `frontend/src/components/shared/RichTextEditor.tsx` — Tiptap-based editor with Bold, Italic, Strikethrough, Bullet List, Ordered List, Link toolbar. Focus ring matches brand amber. Fully controlled (`value` / `onChange` with HTML string).
- **`RichTextDisplay` component** — `frontend/src/components/shared/RichTextDisplay.tsx` — renders stored HTML safely via `dangerouslySetInnerHTML` with Tailwind `prose` class. Returns `null` for empty content.
- **`CreateClubPayload` extended** — added `bannerUrl?: string` to the frontend type (was missing, only present on `UpdateClubPayload`).

**Pages updated:**

| Page | Change |
|---|---|
| `profile/page.tsx` | Avatar URL text input → `<FileUpload type="avatar">` (state managed outside RHF) |
| `events/new/page.tsx` | Description `<textarea>` → `<RichTextEditor>`; Poster URL input → `<FileUpload type="poster">` |
| `clubs/new/page.tsx` | Description `<textarea>` → `<RichTextEditor>`; Logo + Banner URL inputs → `<FileUpload>` pair |
| `clubs/[slug]/manage/page.tsx` | EditTab: same description + logo/banner replacement; schema trimmed (those fields removed from zod) |
| `clubs/[slug]/page.tsx` | Description `<p>` → `<RichTextDisplay>` |
| `events/[id]/page.tsx` | Description `<p>` → `<RichTextDisplay>` |
| `events/[id]/manage/page.tsx` | Description `<p>` → `<RichTextDisplay>` |
| `announcements/page.tsx` | Content `<textarea>` → `<RichTextEditor>`; content display `<p>` → `<RichTextDisplay>` |

**Business logic notes:**
- All description/content fields are now stored as HTML strings in the DB (same column, no migration needed — previous plain-text values still render safely inside `prose` styles).
- Uploaded images are stored as WebP in `backend/public/uploads/<type>/<uuid>.webp` — **not** committed to git; add `backend/public/uploads/` to `.gitignore` if deploying.
- The upload URL returned is absolute: `http://127.0.0.1:5001/uploads/...` — in production, set `NEXT_PUBLIC_API_URL` correctly so images resolve.

---

### Phase U4 — Social & Community ✅ (2026-06-07)

**What was done:**

- **Schema migration** — `20260607062917_add_u4_social`: New models `ClubPost`, `ClubPostComment`, `ClubPostReaction`, `EventQuestion`, `ClubFollow`. Reverse relations added to `User`, `Club`, `Event`.
- **Club Posts backend** — `clubPostController.ts`: `listPosts`, `listComments`, `createPost`, `updatePost`, `deletePost`, `pinPost`, `addComment`, `deleteComment`, `reactToPost`. Officers only can create/pin/delete; members can comment; any authenticated user can react (toggle).
- **Event Q&A backend** — `eventQAController.ts`: `listQuestions`, `submitQuestion` (registered attendees only), `upvoteQuestion`, `answerQuestion` (officers only).
- **Follow system** — `followClub` + `unfollowClub` added to `clubController.ts`. `getClub` now returns `isFollowing` bool and `_count.followers`. `ClubDetail` type + `getClub` return type extended in `lib/clubs.ts`.
- **Activity Feed backend** — `feedController.ts`: `getFeed` merges 4 source types (NEW_EVENT, ANNOUNCEMENT, REMINDER, NEW_MEMBER), deduped by Set of clubIds from memberships + follows, sorted by `createdAt` desc, capped at 50.
- **User Directory backend** — `listUsers` + `getUserProfile` added to `userController.ts`. `GET /users` (search/department/year params) and `GET /users/:userId` (public profile with club memberships + event count).
- **Feed route** — `routes/feed.ts` → mounted at `/feed` in `index.ts`.
- **Frontend lib** — `lib/social.ts`: All types (`ClubPost`, `ClubPostComment`, `EventQuestion`, `FeedItem`, `PublicUser`, `PublicUserDetail`) + API functions for posts, comments, reactions, Q&A, follow/unfollow, feed, user directory.
- **Club Discussion page** — `/clubs/[slug]/discuss/page.tsx`: Pinned-first post list, animated stagger entrance, inline comment expansion with AnimatePresence, thumbs-up reaction toggle, officer pin/delete controls, RichTextEditor for new post body.
- **Activity Feed page** — `/feed/page.tsx`: Tabbed filter (All/Events/Announcements/Reminders/Members), stagger-animated feed cards with type-specific icons + colors, image thumbnail when `posterUrl` available.
- **Member Directory page** — `/members/page.tsx`: Search + department + year filters with 350ms debounce via `use-debounce`, user cards linking to public profile.
- **Public Profile page** — `/profile/[userId]/page.tsx`: Avatar, stats (events attended, reviews given), interests chips, club membership grid with logos.
- **Event Q&A section** — Added collapsible `QASection` component to `events/[id]/page.tsx`: question list sorted by upvotes, upvote button, "Answer" button for officers opens inline modal, question input for registered attendees.
- **Follow + Discuss on Club Profile** — `clubs/[slug]/page.tsx`: Follow/Unfollow toggle button (amber when following, synced via `useEffect`), follower count in stats row, "Discuss" link button to `/clubs/[slug]/discuss`.
- **AppShell nav** — Added "Feed" (Rss icon) and "Members" (Users2 icon) nav items.
- **`use-debounce` installed** in frontend.

**Files created:**
| File | Purpose |
|---|---|
| `backend/src/controllers/clubPostController.ts` ✦ | Club post CRUD + comments + reactions |
| `backend/src/controllers/eventQAController.ts` ✦ | Event Q&A list/submit/upvote/answer |
| `backend/src/controllers/feedController.ts` ✦ | Activity feed aggregator |
| `backend/src/routes/feed.ts` ✦ | `GET /feed` route |
| `frontend/src/lib/social.ts` ✦ | All U4 types + API functions |
| `frontend/src/app/(app)/feed/page.tsx` ✦ | Activity feed with tab filter |
| `frontend/src/app/(app)/members/page.tsx` ✦ | Member directory with search + filters |
| `frontend/src/app/(app)/profile/[userId]/page.tsx` ✦ | Public user profile |
| `frontend/src/app/(app)/clubs/[slug]/discuss/page.tsx` ✦ | Club discussion board |

**Files modified:**
| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | 5 new models + reverse relations on User/Club/Event |
| `backend/src/controllers/clubController.ts` | `followClub`, `unfollowClub` added; `getClub` returns `isFollowing` + `_count.followers` |
| `backend/src/controllers/userController.ts` | `listUsers`, `getUserProfile` added |
| `backend/src/routes/clubs.ts` | Follow routes + all post/comment/react routes |
| `backend/src/routes/events.ts` | Q&A routes |
| `backend/src/routes/users.ts` | `GET /users` + `GET /users/:userId` |
| `backend/src/index.ts` | Mounts `/feed` |
| `frontend/src/lib/clubs.ts` | `ClubDetail._count.followers` + `getClub` return type extended |
| `frontend/src/app/(app)/events/[id]/page.tsx` | `QASection` component added |
| `frontend/src/app/(app)/clubs/[slug]/page.tsx` | Follow button + follower count + Discuss link |
| `frontend/src/components/layout/AppShell.tsx` | Feed + Members nav items |

**New API endpoints:**
```
GET    /feed                                  auth — activity feed (NEW_EVENT, ANNOUNCEMENT, REMINDER, NEW_MEMBER)
POST   /clubs/:id/follow                      auth — follow club (upsert ClubFollow)
DELETE /clubs/:id/follow                      auth — unfollow club
GET    /clubs/:id/posts                       auth — list posts (pinned first)
POST   /clubs/:id/posts                       auth — officer: create post
PUT    /clubs/:id/posts/:postId               auth — author/officer: edit post
DELETE /clubs/:id/posts/:postId               auth — author/officer: delete post
POST   /clubs/:id/posts/:postId/pin           auth — officer: toggle pin
GET    /clubs/:id/posts/:postId/comments      auth — list comments
POST   /clubs/:id/posts/:postId/comments      auth — member: add comment
DELETE /clubs/:id/posts/:postId/comments/:id  auth — author/officer: delete comment
POST   /clubs/:id/posts/:postId/react         auth — toggle reaction (same emoji = remove)
GET    /events/:id/questions                  optionalAuth — list Q&A sorted by upvotes desc
POST   /events/:id/questions                  auth (registered attendee) — submit question
POST   /events/:id/questions/:qId/upvote      auth — increment upvote count
PUT    /events/:id/questions/:qId/answer      auth (officer) — provide answer, marks isAnswered=true
GET    /users                                 auth — user directory (?search= ?department= ?year=)
GET    /users/:userId                         auth — public profile
```

**Business logic:**
- Club post reactions toggle: same emoji → delete; different emoji → update; no reaction → create. Returns `{ action, emoji }`.
- Event Q&A upvote is additive (no dedup) — same as common Q&A tools like Slido.
- Activity feed dedupes clubIds across memberships + follows using `Set`. Caps at 50 items.
- Follow state is synced via `useEffect` watching `data?.isFollowing` to handle query cache updates.
- Officer check in post/comment controllers uses same `isClubOfficer` pattern as `clubController.ts`.

### Phase U5 — Gamification & Engagement ✅ (2026-06-07)

**What was done:**

- **Schema migration** — `20260607065004_u5_gamification`: New models `UserPoints`, `PointTransaction`, `Achievement`, `UserAchievement`. Reverse relations `userPoints` and `achievements` added to `User`.
- **Points service** — `backend/src/services/pointsService.ts`: `awardPoints(userId, reason)` — upserts `UserPoints`, appends `PointTransaction`, computes new level via thresholds (0→50→150→350→700→1200), calls `checkAndUnlockAchievements` after each award. Point values: `EVENT_REGISTERED=5`, `EVENT_ATTENDED=20`, `FEEDBACK_SUBMITTED=10`, `CLUB_JOINED=15`, `CLUB_CREATED=50`, `EVENT_CREATED=30`.
- **Achievement service** — `backend/src/services/achievementService.ts`: Seeds 7 achievements on server start (`first_event`, `regular`, `campus_legend`, `club_founder`, `super_connector`, `voice`, `event_organizer`). `checkAndUnlockAchievements(userId)` evaluates all unlock criteria and inserts `UserAchievement` rows for newly earned badges.
- **Points wiring** — `awardPoints` integrated into: `eventController` (RSVP → `EVENT_REGISTERED`, check-in → `EVENT_ATTENDED`, event approval → `EVENT_CREATED`), `clubController` (club approval → `CLUB_CREATED`, membership approval → `CLUB_JOINED`), `feedbackController` (feedback submit → `FEEDBACK_SUBMITTED`).
- **Leaderboard backend** — `leaderboardController.ts`: `getLeaderboard` (top 20 all-time, `myRank` when user not in top 20), `getSemesterLeaderboard` (filtered to 2026-01-01). Routes at `/leaderboard` using `optionalAuth`.
- **User points & achievements API** — `GET /users/me/points` (points, level, last-10 transactions), `GET /users/me/achievements` (all 7 with `unlocked` flag + `unlockedAt`).
- **Certificate generation** — `POST /reports/certificate` (auth) — PDFKit landscape A4 PDF with amber corner decorations, student name, event title, club, date, signature line. Only issued when `attendance.checkedIn === true`.
- **Frontend lib** — `frontend/src/lib/gamification.ts`: `getMyPoints`, `getMyAchievements`, `getLeaderboard`, `downloadCertificate` (blob→browser download), `levelLabel` (Newcomer→Explorer→Regular→Enthusiast→Champion), `pointsToNextLevel`.
- **Leaderboard page** — `/leaderboard/page.tsx`: Crown (rank 1), Medal (rank 2/3), numbered rank otherwise. All Time / This Semester toggle. Avatar with initials fallback. Points, level, badge count. "You are ranked #N" banner when current user not in top 20. Empty state.
- **Profile page** — Added "Badges & Points" card: XP progress bar (amber gradient), 7-achievement grid (colored when unlocked, greyed+lock icon when not), achievement name/description/unlock-date tooltip.
- **Dashboard widget** — Added points/streak card to student dashboard (visible only when `pts > 0`): links to `/leaderboard`, shows level label, points, progress bar, "N pts to Level X+1".
- **Certificate download button** — Event detail page shows "Download Certificate" button when `isCheckedIn === true`.
- **Leaderboard nav** — `AppShell` gains "Leaderboard" item (Trophy icon) for all roles.
- **Achievement seeding** — `seedAchievements()` called on server start inside `httpServer.listen` callback.

**Files created:**
| File | Purpose |
|---|---|
| `backend/src/services/pointsService.ts` ✦ | Core points award + level computation |
| `backend/src/services/achievementService.ts` ✦ | Seed 7 achievements; unlock checks |
| `backend/src/controllers/leaderboardController.ts` ✦ | All-time + semester leaderboard handlers |
| `backend/src/routes/leaderboard.ts` ✦ | `GET /leaderboard` + `GET /leaderboard/semester` (optionalAuth) |
| `frontend/src/lib/gamification.ts` ✦ | All frontend types + API functions for U5 |
| `frontend/src/app/(app)/leaderboard/page.tsx` ✦ | Full leaderboard page |

**Files modified:**
| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | 4 new models + reverse relations on User |
| `backend/src/controllers/eventController.ts` | `awardPoints` on RSVP, check-in, event approval |
| `backend/src/controllers/clubController.ts` | `awardPoints` on club approval + membership approval |
| `backend/src/controllers/feedbackController.ts` | `awardPoints` on feedback submit |
| `backend/src/controllers/userController.ts` | `getMyPoints`, `getMyAchievements` added |
| `backend/src/controllers/reportController.ts` | `generateCertificate` added |
| `backend/src/routes/users.ts` | `GET /users/me/points` + `GET /users/me/achievements` |
| `backend/src/routes/reports.ts` | `POST /reports/certificate` |
| `backend/src/index.ts` | Mounts `/leaderboard`; calls `seedAchievements()` on start |
| `frontend/src/app/(app)/profile/page.tsx` | "Badges & Points" card section |
| `frontend/src/app/(app)/dashboard/page.tsx` | Points/streak widget (student, pts > 0 only) |
| `frontend/src/app/(app)/events/[id]/page.tsx` | "Download Certificate" button when checked in |
| `frontend/src/components/layout/AppShell.tsx` | Leaderboard nav item |

**New API endpoints:**
```
GET    /leaderboard              optionalAuth — top 20 all-time; myRank if outside top 20
GET    /leaderboard/semester     optionalAuth — top 20 since 2026-01-01; myRank if outside top 20
GET    /users/me/points          auth — { points, level, transactions (last 10) }
GET    /users/me/achievements    auth — all 7 achievements with unlocked + unlockedAt
POST   /reports/certificate      auth — generate PDF cert; requires checkedIn=true
```

**Business logic:**
- Level thresholds: 1→2 at 50pts, 2→3 at 150pts, 3→4 at 350pts, 4→5 at 700pts, 5→6 at 1200pts, then +250 per level.
- Achievements are seeded idempotently (upsert by slug) on every server start — safe to restart.
- `awardPoints` uses `void` pattern (fire-and-forget) from controllers — never blocks the HTTP response.
- Certificate PDF: landscape A4, amber `#EBA814` branding, corner decorations, student name (32pt), event + club + date, signature line. Blob streamed directly from Express → browser download.

### Phase U6 — Smart Event Experience ✅ (2026-06-07)

**What was done:**

- **Schema migration** — `20260607121657_u6_smart_event`: New model `EventReminder` (userId, eventId, minutesBefore unique, sent). Added `isVirtual Boolean`, `meetingUrl String?`, `tags String[]` to `Event`. Added `EVENT_REMINDER` to `NotificationType` enum. Reverse relations added to `User` and `Event`.
- **QR Ticket System** — `ticketController.ts`: `getTicket` signs a 24h JWT containing `{ eventId, userId, type: "ticket" }` — only confirmed (non-waitlisted) registrants can get one. `scanTicket` verifies the JWT, flips `checkedIn`, awards `EVENT_ATTENDED` points, and emits `event:checkin` via Socket.io. `setReminder` upserts an `EventReminder` row (1440/60/15 minutesBefore).
- **Event Reminders cron job** — `backend/src/jobs/reminderJob.ts`: `node-cron` runs every minute, finds unsent reminders whose `triggerAt <= now`, fires `createNotification(EVENT_REMINDER, ...)`, and marks them `sent: true`. Started in `httpServer.listen` callback. Auto-creates a 1-day reminder after every confirmed RSVP.
- **Virtual Event support** — `isVirtual` toggle + `meetingUrl` field on Event. Backend gates `meetingUrl` in `getEvent` response: only revealed when event is live (`startsAt <= now`) AND requester is a confirmed attendee or admin. Event creation/update schemas extended.
- **Waitlist Position** — `getEvent` now computes the count of waitlisted records created at or before the user's, returning `waitlistPosition` on `myRegistration`. Displayed as `#N` amber pill on the event detail page.
- **EventCountdown component** — `frontend/src/components/shared/EventCountdown.tsx`: live ticking countdown with `setInterval(1s)`. Shows "Starts in Xd Xh Xm", "Happening now!" (green), or "Ended" (grey). Mounted below event title on event detail page.
- **QR Ticket on Event Detail** — "Show QR Ticket" button fetches `GET /events/:id/ticket` and renders `<QRCodeSVG>` (qrcode.react) in a dashed amber border box. Only visible to confirmed registered attendees before the event starts.
- **Reminder Picker on Event Detail** — 3 toggle buttons (1 day / 1 hour / 15 min) that call `POST /events/:id/reminders`. Filled amber when active. Visible to confirmed registered attendees before the event starts.
- **Virtual Event join button** — When `event.isVirtual && event.meetingUrl && isStarted`, shows a blue "Join Meeting" button with an external link icon.
- **QR Scanner Page** — `/events/[id]/scan` (officer-only): camera via `Html5QrcodeScanner` (html5-qrcode), green/yellow result flash with attendee name. Manual token input fallback. Linked from officer quick-links on event detail.
- **Event Creation form** — Virtual Event toggle (slide switch) + conditional Meeting URL field added to `events/new/page.tsx`. URL note explains gating behavior.

**Files created:**
| File | Purpose |
|---|---|
| `backend/src/controllers/ticketController.ts` ✦ | `getTicket`, `scanTicket`, `setReminder` handlers |
| `backend/src/jobs/reminderJob.ts` ✦ | node-cron job: fires event reminders every minute |
| `frontend/src/components/shared/EventCountdown.tsx` ✦ | Live ticking countdown component |
| `frontend/src/app/(app)/events/[id]/scan/page.tsx` ✦ | QR scanner page (officer-only, html5-qrcode) |

**Files modified:**
| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | `EventReminder` model, `isVirtual`/`meetingUrl`/`tags` on Event, `EVENT_REMINDER` enum value, reverse relations |
| `backend/src/controllers/eventController.ts` | `isVirtual`/`meetingUrl`/`tags` in create/update schemas and DB writes; `waitlistPosition` + gated `meetingUrl` in `getEvent`; default 1-day reminder creation on confirmed RSVP |
| `backend/src/services/notificationService.ts` | Added `EVENT_REMINDER` to `typeToPreference` map |
| `backend/src/routes/events.ts` | Added `GET /:id/ticket`, `POST /:id/scan`, `POST /:id/reminders` |
| `backend/src/index.ts` | Import + call `startReminderJob()` on server start |
| `frontend/src/lib/events.ts` | `isVirtual`, `meetingUrl`, `tags` on `Event` type; `waitlistPosition` on `MyRegistration`; added `EventTicket`, `ScanResult` types; `getTicket`, `scanTicket`, `setReminder` API functions; `CreateEventPayload` extended |
| `frontend/src/app/(app)/events/[id]/page.tsx` | Countdown below title, virtual event badge, waitlist position `#N` pill, QR ticket display, reminder picker, virtual "Join Meeting" button, QR Scanner officer link |
| `frontend/src/app/(app)/events/new/page.tsx` | Virtual event toggle + conditional Meeting URL field |

**New API endpoints:**
```
GET    /events/:id/ticket          auth (confirmed attendee) — JWT ticket for QR display
POST   /events/:id/scan            auth (officer) — verify + scan a QR ticket token
POST   /events/:id/reminders       auth (registered) — set reminder (minutesBefore: 1440|60|15)
```

**Business logic:**
- Ticket JWT: signed with `JWT_ACCESS_TOKEN_SECRET`, expires 24h. Payload: `{ eventId, userId, type: "ticket" }`.
- `scanTicket` is idempotent for already-checked-in attendees — returns `{ alreadyCheckedIn: true }` instead of error.
- `meetingUrl` gating: only revealed when `startsAt <= now` AND user has a confirmed (non-waitlisted) `REGISTERED` attendance OR is admin.
- Reminders can only be set if the `triggerAt` (startsAt − minutesBefore) is still in the future.
- `upsert` with `sent: false` on reminder creation allows re-enabling a triggered reminder.

### Phase U7 — AI Features ✅ (2026-06-07)

**Goal:** Claude API integration — description assistant, smart recommendations, sentiment analysis.

**What was done:**

- **`@anthropic-ai/sdk` installed** in backend. `ANTHROPIC_API_KEY` added to `backend/.env`.
- **AI Event Description Assistant (U7.1)** — `POST /ai/event-description` (officer-only, auth). Streams an SSE response using `anthropic.messages.stream`. Each `content_block_delta` text chunk is written as `data: {"text":"..."}`. Final frame is `data: [DONE]`. Frontend reads the stream with `ReadableStream`, accumulates chunks into a `built` string, and calls `setDescription(built)` on each chunk so the Tiptap editor fills in live. "AI Assist" button in the description label row; becomes "Regenerate" after generation completes.
- **Smart Recommendations v2 (U7.2)** — `getRecommendations` in `searchController.ts` upgraded from a single `category IN user.interests` filter to a multi-signal scoring algorithm: category match (+3), event from a club the user is a member of (+2), event tag match (+1), starts within 1–7 days (+1). Fetches up to 50 upcoming APPROVED events, scores all of them, and returns the top 8 sorted by score descending. No Claude API call — pure DB + in-process logic.
- **Sentiment Analysis on Feedback (U7.3)** — `getEventFeedback` in `feedbackController.ts` now calls `anthropic.messages.create` after aggregating feedback, if ≥ 2 comments exist. Asks Claude Haiku for a JSON object `{ sentiment, positivePercent, topThemes[3], summary }`. Best-effort: silently skipped on any error or missing API key. The `sentiment` field is included in the `GET /events/:id/feedback` response (null when not available). Frontend `EventFeedbackPage` renders a `SentimentCard` at the top when `sentiment != null`: sentiment gauge with icon, positive % figure, 3 theme chips, and a one-sentence summary. Tagged "Powered by Claude".

**Files created:**
| File | Purpose |
|---|---|
| `backend/src/controllers/aiController.ts` ✦ | `generateEventDescription` — streaming SSE handler |
| `backend/src/routes/ai.ts` ✦ | `POST /ai/event-description` (auth, officer check inside handler) |

**Files modified:**
| File | Change |
|---|---|
| `backend/src/index.ts` | Import + mount `/ai` routes |
| `backend/src/controllers/searchController.ts` | `getRecommendations` → multi-signal scoring (U7.2) |
| `backend/src/controllers/feedbackController.ts` | Import Anthropic SDK; add sentiment analysis block to `getEventFeedback` |
| `backend/.env` | Added `ANTHROPIC_API_KEY` placeholder |
| `frontend/src/lib/analytics.ts` | Added `FeedbackSentiment` type; added `sentiment` field to `EventFeedbackResponse` |
| `frontend/src/app/(app)/events/[id]/feedback/page.tsx` | `SentimentCard` component + rendered when `sentiment != null` |
| `frontend/src/app/(app)/events/new/page.tsx` | `generateWithAI` async function (SSE stream reader); "AI Assist" / "Regenerate" button in description row |

**New API endpoint:**
```
POST   /ai/event-description    auth (officer only) — SSE stream: generates 2-paragraph event description
                                  Body: { title, category?, location? }
                                  Stream: data: {"text":"..."} ... data: [DONE]
```

**Business logic:**
- AI Assist button is disabled during generation. After generation, editing the Tiptap field resets `aiDone → false` so the "Regenerate" state only shows while the AI-generated content is untouched.
- Sentiment analysis requires ≥ 2 non-empty comments to call Claude. The check is skipped entirely if `ANTHROPIC_API_KEY` is missing or blank. JSON parse errors silently return `null`.
- Recommendations scoring: ties are broken by `startsAt` ascending. Returns up to 8 events (raised from 6) for a denser dashboard widget.
- Model used for both AI features: `claude-haiku-4-5-20251001` (fast + low-cost, appropriate for real-time/user-facing inference).

---

### Phase U8 — Calendar & Scheduling ✅ (2026-06-07)

**What was done:**
- **Schema migration** — `icsToken String @unique @default(uuid())` added to `Event` model. Applied via `prisma db push`.
- **iCal export** — `getEventIcs` handler in `eventController.ts`. Builds a standards-compliant ICS string (VCALENDAR/VEVENT) from the event's data. Sets `Content-Type: text/calendar` and streams as a `.ics` attachment. Strips HTML tags from description. Route: `GET /events/:id/ics` (`optionalAuth`, APPROVED events only).
- **Calendar page** — `/calendar/page.tsx` with FullCalendar (Month / Week / Day views). Fetches all APPROVED events via `listEvents`. Events coloured by category (6 named colors) with RSVPd events highlighted in amber `#EBA814`. "All Events / My Events" toggle filters to only the user's RSVPd events. Clicking an event opens an inline popover (title, date range, location, club, "View Event" button). Calendar is SSR-guarded via `useState(mounted)` + dynamic `require()` inside the wrapper component.
- **Add to Calendar buttons** — Two small buttons added below the date/time info grid on `events/[id]/page.tsx` (visible when `status === "APPROVED"`): "Add to Google Calendar" opens a Google Calendar deep-link in a new tab; "Download .ics" triggers a direct download from `GET /events/:id/ics`.
- **RSVP conflict detection** — After capacity check in `registerForEvent`, a soft query finds any overlapping confirmed attendances (same user, APPROVED events, overlapping `startsAt`/`endsAt` window). If a conflict exists, the RSVP proceeds but `warning` is added to the 201 response. Frontend shows a `toast.warning(...)` with 6s duration when `warning` is present.
- **Calendar nav item** — "Calendar" (CalendarDays icon) added to AppShell nav for all roles, positioned after "Events".

**Files created:**
| File | Purpose |
|---|---|
| `frontend/src/app/(app)/calendar/page.tsx` ✦ | FullCalendar month/week/day view with category colour coding, RSVP highlight, event popover |

**Files modified:**
| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Added `icsToken String @unique @default(uuid())` to `Event` |
| `backend/src/controllers/eventController.ts` | `getEventIcs` handler added; soft conflict detection in `registerForEvent` |
| `backend/src/routes/events.ts` | `GET /:id/ics` route added; `getEventIcs` imported |
| `frontend/src/lib/events.ts` | `warning?` field on `registerForEvent` response; `getEventIcsUrl()` + `getGoogleCalendarUrl()` helpers added |
| `frontend/src/app/(app)/events/[id]/page.tsx` | Import `getEventIcsUrl`, `getGoogleCalendarUrl`, `CalendarPlus`; conflict `toast.warning` on RSVP; "Add to Google Calendar" + "Download .ics" buttons |
| `frontend/src/components/layout/AppShell.tsx` | Added `CalendarDays` import; "Calendar" nav item added |

**New API endpoint:**
```
GET /events/:id/ics    optionalAuth — streams a standards-compliant .ics calendar file for APPROVED events
```

**Business logic:**
- `icsToken` is a stable UUID generated at event creation — it never changes, making iCal subscriptions stable.
- ICS output uses `CRLF` line endings as required by RFC 5545. HTML is stripped from description; commas/semicolons/backslashes are escaped.
- Conflict check only runs for confirmed (non-waitlisted) RSVPs and only when `event.endsAt` is set (no end time = no time window to compare). It is a soft check — it warns but never blocks registration.
- Google Calendar URL uses the `render?action=TEMPLATE` deep-link format with all relevant fields URL-encoded.
- FullCalendar packages: `@fullcalendar/react@6.1.20`, `@fullcalendar/core`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/interaction`.

### Phase U9 — PWA & Mobile Push ✅ (2026-06-08)

**What was done:**
- **Schema migration** — New `PushSubscription` model (`endpoint @unique`, `p256dh`, `auth`, `userAgent`, `userId`). Reverse relation `pushSubscriptions` added to `User`. Applied via `prisma db push`.
- **VAPID keys generated** — `npx web-push generate-vapid-keys`. Keys stored in `backend/.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). Public key exposed to frontend via `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in `frontend/.env.local`.
- **Backend push endpoints** — `POST /users/me/push-subscription` (upsert subscription) + `DELETE /users/me/push-subscription` (remove by endpoint). Added to `userController.ts` + `routes/users.ts`.
- **web-push integration in notificationService** — After every `createNotification` and `createBulkNotifications` DB insert, `sendPushToUser` fires `webpush.sendNotification` to all stored subscriptions. Stale subscriptions (410 response) are auto-deleted. Fire-and-forget — never blocks the HTTP response.
- **next-pwa** — `@ducanh2912/next-pwa` installed. `next.config.ts` wraps config with `withPWAInit({ dest: "public", disable: process.env.NODE_ENV === "development", customWorkerSrc: "src/sw-custom" })`. PWA is active only in production. Build script updated to `next build --webpack` (required because next-pwa uses webpack; dev still uses Turbopack).
- **Custom service worker** — `frontend/src/sw-custom/index.ts` handles `push` events (parses JSON payload, calls `showNotification` with amber icon) and `notificationclick` events (focuses existing window or opens new tab at the notification's `link`).
- **manifest.json** — `frontend/public/manifest.json`: name, theme_color `#EBA814`, standalone display, `/dashboard` start_url, SVG icons (192 + 512), 3 shortcuts (Events, Clubs, Notifications).
- **App icons** — `frontend/public/icon-192.svg` + `frontend/public/icon-512.svg` — amber rounded-rect background with white "C" lettermark.
- **Root layout meta** — `theme-color` meta + `apple-touch-icon` link + `manifest` in `Metadata` object added to `frontend/src/app/layout.tsx`.
- **`usePushNotifications` hook** — `frontend/src/hooks/usePushNotifications.ts` — checks browser support, reads current subscription state on mount, exposes `subscribe()` (requests permission → `pushManager.subscribe` → POST to backend) and `unsubscribe()` (DELETE from backend + SW unsubscribe). VAPID key converted via `urlBase64ToUint8Array`.
- **Settings page** — `settings/notifications/page.tsx` gains a "Push Notifications" card at the top when `isSupported`. Shows Enable/Disable button; updates state optimistically.
- **Bug fix** — `reset-password/page.tsx` updated to `async` + `await searchParams` (Next.js 16 breaking change: `searchParams` is now a Promise).

**Files created:**
| File | Purpose |
|---|---|
| `frontend/src/sw-custom/index.ts` ✦ | Custom SW: push event + notificationclick handlers |
| `frontend/public/manifest.json` ✦ | PWA manifest |
| `frontend/public/icon-192.svg` ✦ | PWA icon 192×192 |
| `frontend/public/icon-512.svg` ✦ | PWA icon 512×512 |
| `frontend/src/hooks/usePushNotifications.ts` ✦ | Push subscribe/unsubscribe hook |

**Files modified:**
| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | `PushSubscription` model + `pushSubscriptions` relation on `User` |
| `backend/.env` | Added `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| `backend/src/controllers/userController.ts` | `subscribePush`, `unsubscribePush` handlers |
| `backend/src/routes/users.ts` | `POST/DELETE /users/me/push-subscription` routes |
| `backend/src/services/notificationService.ts` | web-push init + `sendPushToUser` called after every notification |
| `frontend/next.config.ts` | withPWA wrapper |
| `frontend/package.json` | Build script uses `--webpack` flag |
| `frontend/.env.local` | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` |
| `frontend/tsconfig.json` | Exclude `src/sw-custom` from tsc (bundled separately) |
| `frontend/src/app/layout.tsx` | `theme-color` meta, apple-touch-icon, manifest in Metadata |
| `frontend/src/app/(app)/settings/notifications/page.tsx` | Push notifications card |
| `frontend/src/app/reset-password/page.tsx` | Fixed Next.js 16 async searchParams |

**New API endpoints:**
```
POST   /users/me/push-subscription    auth — upsert push subscription (body: { endpoint, keys: { p256dh, auth }, userAgent? })
DELETE /users/me/push-subscription    auth — remove push subscription (body: { endpoint })
```

**Business logic:**
- Push is entirely opt-in — users must click "Enable" on the settings page and grant browser permission.
- Stale subscriptions (410 Gone from web-push) are silently deleted from the DB.
- Service worker is only registered in production (dev has `disable: true`).
- The generated `sw.js` is merged with the custom push handler from `src/sw-custom/index.ts`.
- Web-push fires are fully fire-and-forget (inside `try/catch`) — they never break notification creation.

---

### Phase U11 — Payments & Institutional (COMPLETE 2026-06-08)

**Schema additions:**
- `Payment` model (`userId`, `eventId`, `stripePaymentId @unique`, `amount` in cents, `currency`, `status`)
- `ClubBudget` model (`clubId @unique`, `totalAllocated` in cents, `fiscalYear`, `transactions`)
- `BudgetTransaction` model (`budgetId`, `description`, `amount` in cents, `type INCOME|EXPENSE`, `receiptUrl?`, `createdById`)
- `Event`: `isPaid Boolean @default(false)`, `ticketPrice Int?` (in cents)
- `User`: `payments Payment[]`, `budgetTransactions BudgetTransaction[]`
- `Club`: `budget ClubBudget?`
- `NotificationType`: added `PAYMENT_SUCCEEDED`

**Backend — `backend/src/controllers/paymentController.ts` (new):**
- `createCheckoutSession` — `POST /events/:id/checkout` — creates Stripe Checkout session, returns `{ sessionUrl }`
- `stripeWebhook` — `POST /payments/webhook` — raw body, verifies Stripe signature; on `checkout.session.completed` creates `Payment` + `EventAttendance`, fires `PAYMENT_SUCCEEDED` notification
- `getMyPayments` — `GET /payments/my` — lists user's payment history
- `getClubBudget` — `GET /clubs/:id/budget` — auto-creates budget row on first call; returns totals
- `addBudgetTransaction` — `POST /clubs/:id/budget/transactions` — officer only
- `deleteBudgetTransaction` — `DELETE /clubs/:id/budget/transactions/:txId` — officer only
- `allocateBudget` — `PUT /clubs/:id/budget/allocate` — admin only

**Backend — `backend/src/routes/payments.ts` (new):** `/payments/webhook` (raw body, no auth) + `GET /payments/my`

**Stripe webhook mounted BEFORE `express.json()`** in `index.ts` to receive raw body.

**`backend/.env`:** Added `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` placeholders.

**Event controller:** `isPaid` + `ticketPrice` added to create/update schemas and DB writes; exposed in `listEvents` select.

**Frontend new pages:**
- `frontend/src/app/(app)/my-payments/page.tsx` — payment history with status badges (succeeded/pending/refunded)
- `frontend/src/app/(app)/clubs/[slug]/budget/page.tsx` — officer-only budget dashboard: 4 stat cards (Allocated/Income/Expenses/Balance), spend progress bar, transaction log with receipt image expansion, Add Transaction modal (Income/Expense toggle + receipt upload), Set Allocation modal (admin only)

**Frontend updated:**
- `events/[id]/page.tsx` — When `event.isPaid && event.ticketPrice`: shows "Buy Ticket · $X.XX" button instead of RSVP; redirects to Stripe Checkout. `?payment=success` / `?payment=cancelled` toasts on return. `useSearchParams` added.
- `events/new/page.tsx` — "Paid Event" toggle (amber) + conditional Ticket Price field (in dollars, converted to cents on submit)
- `events/page.tsx` — Price badge ($X.XX) shown on paid event cards
- `clubs/[slug]/manage/page.tsx` — "Budget" button added to page header
- `AppShell.tsx` — "My Payments" nav item (CreditCard icon) for all users

**`frontend/src/lib/budget.ts` (new):** `ClubBudget`, `BudgetTransaction` types + `getClubBudget`, `addBudgetTransaction`, `deleteBudgetTransaction`, `allocateBudget`, `formatCurrency` functions.

**`frontend/src/lib/events.ts`:** `isPaid` + `ticketPrice` on `Event` type; `createCheckoutSession` + `getMyPayments` + `PaymentRecord` type added.

**Business logic:**
- Stripe checkout: `POST /events/:id/checkout` validates event is APPROVED + isPaid + not past deadline + user not already registered. Returns `{ sessionUrl }` to redirect to.
- Webhook is idempotent: upserts `Payment` by `stripePaymentId`; upserts `EventAttendance` by `[eventId, userId]`.
- If `STRIPE_SECRET_KEY` is missing/placeholder, all payment endpoints return 503 (graceful degradation).
- Budget amounts stored in cents (integer). `formatCurrency(cents)` helper converts for display.
- Budget row auto-created on first `GET /clubs/:id/budget` if one doesn't exist.
- `totalAllocated` is set by admins via `PUT /clubs/:id/budget/allocate`; `totalIncome`/`totalExpenses`/`balance` are computed live from transactions on every GET.

---

### Phase U12 — Integrations (COMPLETE 2026-06-08)

**Schema additions:**
- `User`: `googleId String? @unique` — for Google OAuth account linking
- `ClubIntegration` model (`clubId`, `type SLACK|DISCORD`, `webhookUrl`, `events String[]`). Unique constraint `[clubId, type]`. Reverse relation `integrations ClubIntegration[]` added to `Club`.

**Backend — Swagger UI (`backend/src/lib/swagger.ts`):**
- Full OpenAPI 3.0.3 spec with all 50+ endpoints, schemas (User, Club, Event, Notification, ClubIntegration, etc.), and tags.
- Served at `GET /api/docs` via `swagger-ui-express`.
- Raw JSON spec at `GET /api/docs.json`.
- Available in both dev and production.

**Backend — Google OAuth (`authController.ts`):**
- `GET /auth/google` — redirects to Google's OAuth consent URL (requires `GOOGLE_CLIENT_ID` in env; returns 503 if not configured).
- `GET /auth/google/callback` — exchanges code for token, fetches user info from Google, find-or-create user (links `googleId` on existing email accounts), issues JWT pair, creates Session row, redirects to `FRONTEND_URL/auth/google/callback?accessToken=...&refreshToken=...&userId=...&name=...&email=...&role=...`.
- Existing email accounts are linked by matching on email — `googleId` is patched in.
- Google OAuth users get `emailVerified: true` and `password: ""`.

**Backend — Integrations (`integrationController.ts` + `routes/integrations.ts`):**
- `GET /clubs/:id/integrations` — officer/admin only — list integrations for a club.
- `POST /clubs/:id/integrations` — officer/admin — upsert integration by `[clubId, type]`. Body: `{ type, webhookUrl, events }`.
- `DELETE /clubs/:id/integrations/:integrationId` — officer/admin — delete.

**Backend — Webhook Service (`services/webhookService.ts`):**
- `fireWebhooks(clubId, event, payload, clubName)` — looks up `ClubIntegration` rows matching the event type, POSTs formatted payloads.
- Discord: rich embed with title, description, URL, amber color `0xEBA814`.
- Slack: plain `text` message.
- 5s timeout per call; entirely fire-and-forget.
- Wired into: `eventController.approveEvent` (→ `NEW_EVENT`), `clubController.approveMembership` (→ `NEW_MEMBER`), `announcementController.createAnnouncement` (→ `ANNOUNCEMENT` for club announcements only).

**`backend/.env`:** Added `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` placeholders.

**Frontend new pages:**
- `frontend/src/app/auth/google/callback/page.tsx` — handles OAuth redirect. Reads tokens + user from query params, calls `setAuthState`, shows spinner during processing, redirects to `/dashboard` on success or `/login` on error.

**Frontend updated:**
- `login/page.tsx` — "Login with Google" placeholder `<button>` → real `<a>` linking to `NEXT_PUBLIC_API_URL/auth/google`.
- `register/page.tsx` — same for "Sign up with Google".
- `clubs/[slug]/manage/page.tsx` — new "Integrations" tab (`Tab = "integrations"`). `IntegrationsTab` component: lists existing integrations, "+ Add Integration" button opens inline form (type toggle, webhook URL input, event checkboxes), upserts via API, delete per row.

**`frontend/src/lib/integrations.ts` (new):** `ClubIntegration` type, `IntegrationEvent` type, `INTEGRATION_EVENT_LABELS`, `listIntegrations`, `upsertIntegration`, `deleteIntegration`.

**New packages installed:**
- Backend: `swagger-jsdoc`, `swagger-ui-express`, `passport`, `passport-google-oauth20` (+ types).
- Note: Google OAuth implemented without passport (manual OAuth 2.0 code exchange via `fetch`) — avoids ESM compatibility issues.

**Business logic:**
- Google OAuth is gracefully degraded: if `GOOGLE_CLIENT_ID` is missing, `GET /auth/google` returns 503 instead of crashing.
- `findFirst({ OR: [{ googleId }, { email }] })` ensures existing email accounts get linked rather than duplicated.
- Suspended accounts: `GET /auth/google/callback` redirects to `/login?error=account_suspended`.
- Integrations are upserted by `[clubId, type]` — only one Slack and one Discord per club. Re-saving changes the URL and event list.
- Webhook calls use `AbortSignal.timeout(5000)` — stale/bad URLs time out silently.

---

## What Remains

All 12 upgrade phases are now **complete**. The Club Connect platform covers all 73 original use cases and all 12 upgrade phases (U1–U12).

---

## How to Resume

```bash
# Backend (port 5001)
cd backend
npm run dev

# Frontend (port 3000)
cd frontend
npm run dev

# View / edit database
cd backend
npx prisma studio
```

**Required env file:** `backend/.env`

```
DATABASE_URL=postgresql://...
JWT_ACCESS_TOKEN_SECRET=...
JWT_REFRESH_TOKEN_SECRET=...
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
FRONTEND_URL=http://127.0.0.1:3000
```
