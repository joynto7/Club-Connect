# Settings Tab Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared horizontal tab bar above the three Settings pages (Notifications / Sessions / Security) so a user can jump between them without returning to the sidebar.

**Architecture:** A single new Next.js `layout.tsx` under `frontend/src/app/(app)/settings/`. Next.js automatically nests it around the three existing settings pages — no changes to those pages or to `AppShell.tsx`. Pure client-side presentational wrapper: no data fetching, no new state beyond reading the current route.

**Tech Stack:** Next.js App Router (client component), `next/navigation`'s `usePathname`, `lucide-react` icons — all already in use elsewhere in this codebase. No new dependencies.

**Full design context:** `docs/superpowers/specs/2026-07-20-settings-tab-bar-design.md` — read it if anything below is unclear on *why*, not just *what*.

## Global Constraints

- No new npm dependencies.
- No changes to `notifications/page.tsx`, `sessions/page.tsx`, `security/page.tsx`, or `AppShell.tsx`.
- No test framework — do not add Jest/Vitest/etc. Verify with `tsc --noEmit` and the manual browser steps given below.
- Brand color `#EBA814` and the sidebar's existing active-state style (`bg-[#EBA814]/10 text-[#EBA814]`) are the established "active nav item" language — match them, don't invent a new active-state style (e.g. underline tabs).
- Icons are lucide-react only, reusing exactly the icons `AppShell.tsx` already assigns to these three destinations (`Settings`, `Monitor`, `ShieldCheck`) rather than choosing new icons for the same items.
- Active-tab detection is exact-match `pathname === href` (none of these three routes have sub-routes).
- Tab bar wrapped in `max-w-2xl mx-auto` (matching Sessions/Security's existing content width). Page content containers are untouched — Notifications keeps its own `max-w-lg` and simply renders narrower than the tab bar above it, same as today.

---

### Task 1: Add the Settings tab bar layout

**Files:**
- Create: `frontend/src/app/(app)/settings/layout.tsx`

**Interfaces:**
- Consumes: nothing from the rest of the codebase beyond `next/link`, `next/navigation`, and `lucide-react` (all already dependencies).
- Produces: nothing consumed elsewhere — this is a leaf layout with no other task depending on it.

- [ ] **Step 1: Create the layout file**

Create `frontend/src/app/(app)/settings/layout.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Monitor, ShieldCheck } from "lucide-react";

const TABS = [
  { label: "Notifications", href: "/settings/notifications", icon: <Settings size={16} /> },
  { label: "Sessions",      href: "/settings/sessions",       icon: <Monitor size={16} /> },
  { label: "Security",      href: "/settings/security",       icon: <ShieldCheck size={16} /> },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <nav className="max-w-2xl mx-auto flex items-center gap-1 border-b border-gray-100 dark:border-zinc-800 pb-2">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? "bg-[#EBA814]/10 text-[#EBA814]"
                  : "text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {tab.icon}
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
```

This matches `AppShell.tsx`'s exact active/inactive class strings for nav items (`bg-[#EBA814]/10 text-[#EBA814]` vs. `text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white`), and its exact icon choice for each of these three items — so it reads as the same design system, not a new one.

- [ ] **Step 2: Type-check the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual browser verification**

Start the frontend dev server (`cd frontend && npm run dev`) and log in. Navigate to `http://localhost:3000/settings/notifications`.

Expected:
- A tab bar with "Notifications", "Sessions", "Security" renders above the page content; "Notifications" is highlighted (gold background/text).
- Clicking "Sessions" navigates to `/settings/sessions`; the Active Sessions page renders below, and "Sessions" is now the highlighted tab instead.
- Clicking "Security" navigates to `/settings/security`; the Security Settings page renders below, and "Security" is now highlighted.
- Toggling dark mode (via the theme toggle at the bottom of the sidebar) — tab bar colors adapt (dark background/border, gold highlight still visible).
- Narrowing the browser window to mobile width — all three tabs still fit on one row without wrapping or overflowing.

- [ ] **Step 4: Commit**

```bash
cd "/Users/joyntoghosh/Club Connect"
git add "frontend/src/app/(app)/settings/layout.tsx"
git commit -m "$(cat <<'EOF'
Add tab bar navigation to Settings pages

Shared layout.tsx nests Notifications/Sessions/Security under one
horizontal tab bar, styled to match the sidebar's existing active-item
look. No changes to the three pages or to AppShell.tsx — they keep
their own URLs, data-fetching, and content exactly as before.
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** Goals (shared tab bar, pages unchanged) → Task 1 Step 1. Non-goals (no sidebar change, no route merge, no sub-sidebar, no test framework) → satisfied by not touching any other file and by Step 2/3 being type-check + manual verification only. Frontend changes section (tab array shape, active-state styling, `max-w-2xl` container, dark mode) → Task 1 Step 1, verified line-by-line against the spec. Error handling ("none needed") → no error-handling code present, correctly. Verification section (manual: tabs, dark mode, mobile width) → Task 1 Step 3, same three checks.
- **Placeholder scan:** no TBD/TODO; the layout file is shown complete and copy-pasteable; verification steps describe exact clicks and exact expected results, not "add appropriate checks."
- **Type consistency:** single-file, single-task plan — no cross-task interfaces to reconcile. The one exported symbol (`SettingsLayout`, default export) isn't imported anywhere else; Next.js wires it in by file-system convention.
- **Task ordering:** only one task; no ordering constraints.
