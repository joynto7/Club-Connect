# Settings tab bar — design

## Context

Settings today is three fully independent routes — `/settings/notifications`, `/settings/sessions`, `/settings/security` — each with its own `<h1>` and no shared navigation between them. There's no `settings/layout.tsx`. The only way to move between the three is back through the main sidebar's "Settings" group (`AppShell.tsx`).

## Goals

- Give the three settings pages a shared horizontal tab bar so a user can jump between Notifications / Sessions / Security without returning to the sidebar.
- Keep each page's existing URL, data-fetching, and content completely unchanged.

## Non-goals

- **Changing `AppShell.tsx`'s sidebar** — the "Settings" group's three links stay exactly as-is and still work as direct deep links.
- **Merging the three pages into one route / client-side tab-panel state** — routes stay real and deep-linkable. (Considered and rejected: loses bookmarkable URLs, would require rewriting how the sidebar links to settings and merging three pages' independent data-fetching into one file, for no real benefit over a shared layout.)
- **A second vertical sub-sidebar** — three items don't justify a sidebar-style column next to the existing sidebar. (Considered and rejected in favor of a horizontal bar, which also matches the original ask more directly.)
- **Adding a test framework** — this repo has none today (no Jest/Vitest, no `test` script in either `package.json`); verification is manual.

## Frontend changes

New file: `frontend/src/app/(app)/settings/layout.tsx` (client component). Next.js nests all three existing pages under it automatically — no changes to `notifications/page.tsx`, `sessions/page.tsx`, or `security/page.tsx`.

- Local `TABS` array (`{label, href}` for Notifications / Sessions / Security) — same inline-array style already used for `getNavGroups` in `AppShell.tsx` and `sections` in `admin/page.tsx`, not a new shared type or abstraction.
- Horizontal row of `Link`s rendered above `{children}`; active tab detected via `usePathname() === href`, styled with the same gold highlight (`text-[#EBA814]`, `bg-[#EBA814]/10`) the sidebar already uses for its active item, so it reads as the same design system.
- Tab bar row wrapped in its own `max-w-2xl mx-auto` container — matching Sessions/Security's existing content width. (The three pages are *not* consistently sized: Notifications uses `max-w-lg`, Sessions and Security use `max-w-2xl`. The layout doesn't touch any page's own inner container, so Notifications' content simply continues to render narrower than the tab bar above it, same as today.)
- Dark-mode classes (`dark:` variants) included, matching the rest of the app.

## Error handling

None needed — pure presentational routing wrapper. No data fetching, no new failure modes.

## Verification

No frontend test framework exists in this repo today (checked `package.json` scripts and for `*.test.tsx`/`*.spec.tsx` files — none found) — not adding one for a static nav bar. Verify manually in the dev server:

- Click through all three tabs; confirm the active-state highlight follows the current route.
- Check dark mode.
- Check mobile width — three short labels in a flex row, no overflow expected.
