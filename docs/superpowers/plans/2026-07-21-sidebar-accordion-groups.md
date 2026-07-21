# Sidebar Accordion Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the sidebar's nav groups collapsible (accordion), regroup Venues/Resources/My Bookings into one new "Bookings" group, and remember each user's expand/collapse choice — without removing any existing nav item or route.

**Architecture:** All changes live in one file, `frontend/src/components/layout/AppShell.tsx`. Task 1 reshuffles the static `getNavGroups()` array (pure data, zero behavior change). Task 2 adds `expandedGroups` state (persisted to `localStorage`, same pattern as the existing `cc-sidebar-collapsed` sidebar-width toggle), a toggle handler, an auto-expand-active-group effect, and swaps the group header from a static `<p>` to a clickable `<button>` with a chevron.

**Tech Stack:** Next.js client component, React `useState`/`useEffect`, `lucide-react` icons (all already in use). No new dependencies.

**Full design context:** `docs/superpowers/specs/2026-07-21-sidebar-accordion-groups-design.md` — read it if anything below is unclear on *why*, not just *what*.

## Global Constraints

- No new npm dependencies — `ChevronDown` is already part of the installed `lucide-react` package, just not yet imported in this file.
- No test framework in this repo (no Jest/Vitest, no `test` script) — do not add one. Verify with `cd frontend && npx tsc --noEmit` plus the manual browser steps given in each task.
- Zero nav items removed. Before and after both tasks, the total item count per role must be unchanged — only which group an item lives in, and whether that group is visibly expanded, changes.
- The icon-only collapsed sidebar (`collapsed && !mobile`, toggled by the existing `PanelLeftClose`/`PanelLeftOpen` button) is completely unaffected — it must keep showing every item from every group flattened, with no headers, exactly as today.
- Reuse the sidebar's existing active-state language (`bg-[#EBA814]/10 text-[#EBA814]` for active, `text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white` for inactive) — don't invent a new style for the new button/chevron.
- `localStorage` key for the new feature is `cc-sidebar-groups`, storing a JSON object `Record<string, boolean>` keyed by group label — same key-per-feature convention as the existing `cc-sidebar-collapsed`.

---

### Task 1: Regroup Venues/Resources/My Bookings into a new "Bookings" group

**Files:**
- Modify: `frontend/src/components/layout/AppShell.tsx` (inside `getNavGroups`, currently lines 37–55)

**Interfaces:**
- Consumes: nothing new — `Building2`, `Package`, `BookMarked` icons are already imported (line 11).
- Produces: a `NavGroup` object with `label: "Bookings"` that Task 2's rendering code iterates over identically to every other group — no special-casing by group name anywhere.

- [ ] **Step 1: Edit `getNavGroups()`**

In `frontend/src/components/layout/AppShell.tsx`, find this exact block (currently the `Community` and `Personal` groups):

```tsx
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
```

Replace it with:

```tsx
    {
      label: "Community",
      items: [
        { label: "Members",       href: "/members",       icon: <IdCard size={18} /> },
        { label: "Leaderboard",   href: "/leaderboard",   icon: <Trophy size={18} /> },
        { label: "Announcements", href: "/announcements", icon: <Megaphone size={18} /> },
      ],
    },
    {
      label: "Bookings",
      items: [
        { label: "Venues",      href: "/venues",      icon: <Building2 size={18} /> },
        { label: "Resources",   href: "/resources",   icon: <Package size={18} /> },
        { label: "My Bookings", href: "/my-bookings", icon: <BookMarked size={18} /> },
      ],
    },
    {
      label: "Personal",
      items: [
        { label: "My Payments",   href: "/my-payments", icon: <CreditCard size={18} /> },
        { label: "My Profile",    href: "/profile",     icon: <User size={18} /> },
        { label: "My Activities", href: "/activities",  icon: <History size={18} /> },
      ],
    },
```

- [ ] **Step 2: Type-check the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual browser verification**

Start the frontend dev server and log in as a Student or Club Officer. Open the sidebar.

Expected:
- A "Bookings" group header appears between "Community" and "Personal", containing exactly Venues, Resources, My Bookings (in that order).
- "Community" now contains exactly Members, Leaderboard, Announcements (Venues/Resources gone).
- "Personal" now contains exactly My Payments, My Profile, My Activities (My Bookings gone).
- Every item still navigates to the same URL as before (e.g. "Venues" still goes to `/venues`).
- Total number of visible sidebar items is unchanged from before this edit.

- [ ] **Step 4: Commit**

```bash
cd "/Users/joyntoghosh/Club Connect"
git add frontend/src/components/layout/AppShell.tsx
git commit -m "$(cat <<'EOF'
Regroup Venues/Resources/My Bookings into one Bookings section

These three were one workflow split across two different sidebar
groups (Community and Personal). No items removed, no routes changed.
EOF
)"
```

---

### Task 2: Make sidebar groups collapsible with persistence

**Files:**
- Modify: `frontend/src/components/layout/AppShell.tsx` (icon import, `AppShell` component state/effects, and the group-rendering block inside the `Sidebar` sub-component)

**Interfaces:**
- Consumes: the `NavGroup[]` produced by Task 1's `getNavGroups()` — iterates every group identically, no group-name special-casing.
- Produces: nothing consumed by other tasks — this is the last task in the plan.

- [ ] **Step 1: Import `ChevronDown`**

Find this import (line 9-15):

```tsx
import {
  LayoutDashboard, CalendarClock, Users2, IdCard, User, History, LogOut,
  Menu, Building2, Package, BookMarked, ChevronRight,
  Megaphone, Settings, SlidersHorizontal, BarChart2, ShieldCheck, Monitor,
  FileText, ScrollText, LayoutGrid, UserCog, Activity,
  PanelLeftClose, PanelLeftOpen, Command, Rss, Trophy, CalendarDays, CreditCard,
} from "lucide-react";
```

Replace the `ChevronRight` line with:

```tsx
  Menu, Building2, Package, BookMarked, ChevronRight, ChevronDown,
```

- [ ] **Step 2: Add expand/collapse state and effects to `AppShell`**

Find this block (the top of the `AppShell` component, originally lines 123–136 — line numbers will have shifted by +5 after Task 1's edit, so match on the code below rather than the line number):

```tsx
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const auth = getAuthState();
    if (!auth) { router.replace("/login"); return; }
    setUser(auth.user);
    const stored = localStorage.getItem("cc-sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, [router]);
```

Replace it with:

```tsx
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ Main: true });

  useEffect(() => {
    const auth = getAuthState();
    if (!auth) { router.replace("/login"); return; }
    setUser(auth.user);
    const stored = localStorage.getItem("cc-sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
    const storedGroups = localStorage.getItem("cc-sidebar-groups");
    if (storedGroups) {
      try {
        setExpandedGroups((prev) => ({ ...prev, ...JSON.parse(storedGroups) }));
      } catch {
        // Ignore malformed localStorage value — keep the default.
      }
    }
  }, [router]);

  // Auto-expand whichever group contains the page the user is currently on,
  // so a direct link/reload never lands on a page whose own group is hidden.
  useEffect(() => {
    if (!user) return;
    const groups = getNavGroups(user.role);
    const activeGroup = groups.find((g) =>
      g.items.some((item) => pathname === item.href || (!item.exact && pathname.startsWith(item.href + "/")))
    );
    if (!activeGroup) return;
    setExpandedGroups((prev) => {
      if (prev[activeGroup.label]) return prev;
      const next = { ...prev, [activeGroup.label]: true };
      localStorage.setItem("cc-sidebar-groups", JSON.stringify(next));
      return next;
    });
  }, [pathname, user]);
```

- [ ] **Step 3: Add the `toggleGroup` handler**

Find this block (immediately follows the effects added in Step 2):

```tsx
  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem("cc-sidebar-collapsed", String(next));
      return next;
    });
  };
```

Replace it with:

```tsx
  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem("cc-sidebar-collapsed", String(next));
      return next;
    });
  };

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      localStorage.setItem("cc-sidebar-groups", JSON.stringify(next));
      return next;
    });
  };
```

- [ ] **Step 4: Make the group header clickable and gate the items list on expand state**

Find this block (inside the `Sidebar` sub-component's `<nav>`):

```tsx
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
```

Replace it with:

```tsx
        {navGroups.map((group) => {
          const expanded = expandedGroups[group.label] ?? false;
          return (
            <div key={group.label}>
              {(!collapsed || mobile) && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400"
                >
                  {group.label}
                  <ChevronDown size={12} className={`transition-transform ${expanded ? "" : "-rotate-90"}`} />
                </button>
              )}
              {((collapsed && !mobile) || expanded) && (
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
              )}
            </div>
          );
        })}
```

- [ ] **Step 5: Type-check the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual browser verification**

Start the frontend dev server and log in as a Student or Club Officer. Clear `localStorage` first (DevTools → Application → Local Storage → clear, or `localStorage.clear()` in the console) to test from a clean state.

Expected, in order:
1. Sidebar loads with "Main" expanded (chevron pointing down) and every other group collapsed (chevron pointing right, only the header row visible).
2. Click "Community" header → it expands (Members/Leaderboard/Announcements appear, chevron rotates to point down). Click it again → collapses back.
3. Reload the page → whichever groups you left expanded/collapsed are exactly as you left them.
4. With "Bookings" collapsed, navigate directly to `http://localhost:3000/venues` by typing the URL → "Bookings" auto-expands and "Venues" shows as the active item, even though you never clicked its header.
5. Click the existing sidebar collapse button (bottom of sidebar) to switch to icon-only mode → every item from every group still shows as an icon in one flat list, completely unaffected by which groups were expanded/collapsed in step 1-4. Expand back out of icon-only mode → your group expand/collapse state from before is still there.
6. Toggle dark mode (theme toggle at the bottom of the sidebar) → group headers, chevrons, and hover states adapt with no unstyled/invisible elements.
7. Narrow the browser to mobile width and open the mobile drawer (hamburger icon) → repeat steps 2-4 in the mobile drawer; same behavior.
8. Log in as a University Admin → confirm the "Admin" group (Admin Panel, Analytics, Reports) collapses/expands the same way as every other group.
9. Log in as a System Admin → confirm the full "Admin" group (all 7 items) collapses/expands the same way.

- [ ] **Step 7: Commit**

```bash
cd "/Users/joyntoghosh/Club Connect"
git add frontend/src/components/layout/AppShell.tsx
git commit -m "$(cat <<'EOF'
Make sidebar nav groups collapsible

Each group header is now a button that expands/collapses its items,
persisted per-user in localStorage (cc-sidebar-groups). The group
containing the current page always auto-expands on load/navigation.
Icon-only collapsed sidebar mode is unaffected — it still shows every
item flattened, as before.
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** Goals (collapsible groups → Task 2 Steps 2-4; Bookings regroup → Task 1 Step 1; localStorage persistence → Task 2 Step 2/3; auto-expand active group → Task 2 Step 2's second effect) all map to a task. Non-goals (no items removed → enforced by Task 1's item-for-item move, verified in Task 1 Step 3 and Task 2 Step 6; icon-only mode unchanged → explicit `(collapsed && !mobile) ||` clause in Task 2 Step 4, verified in Task 2 Step 6.5; no rail/panel or "More" menu → not built, single-column list kept throughout) are satisfied by what's absent as much as what's present. Final grouping table → Task 1 Step 1's exact before/after code. Error handling (spec: "none needed beyond what's already there") → the one addition, a `try/catch` around `JSON.parse` of a user-mutable `localStorage` value, is a one-line guard against corrupted storage, not new infrastructure — this is a deliberate, small deviation from the spec's literal "no try/catch" comparison (that comparison was to a boolean-string read, which can't throw the way `JSON.parse` can); noted here rather than silently diverging.
- **Placeholder scan:** no TBD/TODO; every step shows complete, copy-pasteable code; verification steps list exact clicks and exact expected results per role, not "add appropriate checks."
- **Type consistency:** `expandedGroups: Record<string, boolean>` (Task 2 Step 2) is the only new type, read the same way in Step 3 (`toggleGroup`) and Step 4 (render) — no renamed variants. `toggleGroup(label: string)` signature matches its one call site (`onClick={() => toggleGroup(group.label)}`) in Step 4. `NavGroup`/`NavItem` types (pre-existing, untouched) are used identically in both tasks.
- **Task ordering:** Task 2 depends on Task 1's final group labels (specifically `"Bookings"` existing as a distinct group) only insofar as Task 2's manual verification step 4 references `/venues` moving with its new group — the accordion logic itself (Steps 1-5) is group-name-agnostic and would work against the original 4-group layout too. Task 1 has no dependency on Task 2. Order given (1 then 2) is the simpler review path, not a hard technical requirement.
- **Line-number drift:** Task 1's edit shifts every subsequent line in the file down by 5 (new Bookings group is 8 lines; Community shrinks by 2, Personal by 1: net +5). Task 2's steps therefore match on exact code blocks rather than asserting line numbers that would already be stale the moment Task 1 lands.
