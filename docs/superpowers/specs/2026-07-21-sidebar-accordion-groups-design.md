# Sidebar accordion groups — design

## Context

`getNavGroups()` in [AppShell.tsx:25](frontend/src/components/layout/AppShell.tsx:25) renders every nav item, in every group, fully expanded, all the time — 17 items across 4 groups (Main, Community, Personal, Settings) for Student/Club Officer, ~20 for University Admin, ~23 for System Admin (extra Admin group). An earlier direction considered removing lower-priority items for a v1 launch; the user decided against cutting anything — this design keeps every existing item and route untouched, and only changes how much is visible at once, inspired by how Messenger organizes many features without a cluttered feel.

## Goals

- Make each nav group collapsible/expandable (accordion), so most groups can sit collapsed to just a header most of the time.
- Regroup "Venues", "Resources" (currently under Community) and "My Bookings" (currently under Personal) into one new "Bookings" group — these are one workflow split across two sections today.
- Remember each user's expand/collapse choice per group across sessions (localStorage), same pattern as the existing sidebar-width collapse toggle (`cc-sidebar-collapsed`).
- Auto-expand whichever group contains the page the user is currently on, so navigating to a page never hides its own nav group.

## Non-goals

- **Removing any nav item or route.** Every item in the table below exists today; none are cut.
- **Changing the icon-only collapsed sidebar mode** (`collapsed && !mobile`, the width-16 icon rail toggled by the existing panel-collapse button). That mode already shows a flat icon list with no group headers — accordion state doesn't apply there; it's unchanged.
- **A rail + secondary panel layout, or a "More" overflow menu** — both explored with mockups and rejected in favor of the smallest change: same single-column list, just collapsible.
- **Per-group item counts/badges, drag-to-reorder, or user-customizable groups** — not asked for.

## Final grouping

| Group | Items | Default state |
|---|---|---|
| Main | Dashboard, Feed, Events, Calendar, Clubs | Expanded |
| Community | Members, Leaderboard, Announcements | Collapsed |
| Bookings *(new)* | Venues, Resources, My Bookings | Collapsed |
| Personal | My Payments, My Profile, My Activities | Collapsed |
| Settings | Notifications, Sessions, Security | Collapsed |
| Admin *(role-gated, unchanged membership)* | Admin Panel, Analytics, Reports, Users, System Settings, Audit Log, System Monitor | Collapsed |

## Frontend changes

All in `frontend/src/components/layout/AppShell.tsx`:

- `getNavGroups()`: move `Venues`/`Resources` out of the `Community` array and `My Bookings` out of `Personal`, into a new `Bookings` group inserted after `Community`. No other array contents change.
- New state in `AppShell`: `expandedGroups: Record<string, boolean>`, initialized from `localStorage.getItem("cc-sidebar-groups")` (JSON-parsed) on mount, same pattern as the existing `cc-sidebar-collapsed` read (line 134). Default when no stored value exists: `{ Main: true }` (every other group falsy/collapsed).
- `toggleGroup(label)`: flips `expandedGroups[label]`, writes the merged object back to `localStorage["cc-sidebar-groups"]`.
- Auto-expand effect: on mount and whenever `pathname` changes, find the group containing the active item (same `active` check already used per-item at line 207) and, if it isn't already `true` in `expandedGroups`, set it `true` (and persist). This is a one-time nudge, not a permanent lock — the user can still collapse it manually afterward.
- Render: group header (currently a `<p>`) becomes a `<button>` (keyboard/screen-reader accessible) with the group label plus a chevron (`ChevronRight`/`ChevronDown` from `lucide-react` — `ChevronDown` isn't imported yet, needs adding) rotated by expand state, `onClick={() => toggleGroup(group.label)}`. The group's `items.map(...)` block only renders when `(!collapsed || mobile)` (existing condition) **and** `expandedGroups[group.label]`.
- Icon-only collapsed sidebar (`collapsed && !mobile`): unchanged — still renders every item from every group flattened, no headers, exactly as today. This mode never reads `expandedGroups`.
- Both auto-expand and manual toggle apply identically on mobile — `Sidebar({ mobile })` is a shared component, this isn't a mobile-specific change (see Non-goals).

## Error handling

None needed beyond what's already there — pure client-side UI state, no new network calls or data fetching. The `localStorage` read follows the same convention as the existing `cc-sidebar-collapsed` read (inside the existing mount `useEffect`, no try/catch today — matching existing convention rather than adding one only for the new key).

## Verification

No frontend test framework exists in this repo (no Jest/Vitest, no `test` script in `package.json`) — matches prior specs' findings. Verify manually in the dev server, per role:

- Student/Club Officer: confirm Main starts expanded, other groups collapsed; click each header, confirm expand/collapse + chevron rotation; reload, confirm state persisted; navigate directly to `/venues`, confirm Bookings auto-expands even though collapsed by default.
- University Admin: confirm Admin group shows only its 3 capability-gated items, same accordion behavior.
- System Admin: confirm the full Admin group (7 items) behaves the same way.
- Collapse the sidebar to icon-only mode: confirm it still shows every item flattened, unaffected by group expand/collapse state.
- Mobile drawer: repeat the expand/collapse + persistence check.
- Dark mode: confirm chevron and header hover states use existing `dark:` classes, no new hardcoded colors.
