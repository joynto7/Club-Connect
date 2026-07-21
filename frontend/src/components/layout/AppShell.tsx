"use client";

import Link from "next/link";
import Image from "next/image";
import LogoIcon from "@/components/shared/LogoIcon";
import ThemeToggle from "@/components/shared/ThemeToggle";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, CalendarClock, Users2, IdCard, User, History, LogOut,
  Menu, Building2, Package, BookMarked, ChevronRight, ChevronDown,
  Megaphone, Settings, SlidersHorizontal, BarChart2, ShieldCheck, Monitor,
  FileText, ScrollText, LayoutGrid, UserCog, Activity,
  PanelLeftClose, PanelLeftOpen, Command, Rss, Trophy, CalendarDays, CreditCard,
} from "lucide-react";
import { getAuthState, clearAuthState } from "@/lib/tokenStorage";
import type { UserInfo } from "@/lib/tokenStorage";
import { hasCapability } from "@/lib/permissions";
import NotificationBell from "@/components/shared/NotificationBell";
import GlobalSearchBar from "@/components/shared/GlobalSearchBar";

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
  if (hasCapability(role, "viewDashboardStats")) {
    adminItems.push({ label: "Admin Panel", href: "/admin", icon: <LayoutGrid size={18} />, exact: true });
  }
  if (hasCapability(role, "viewAnalytics")) {
    adminItems.push({ label: "Analytics", href: "/analytics", icon: <BarChart2 size={18} /> });
  }
  if (hasCapability(role, "viewReports")) {
    adminItems.push({ label: "Reports", href: "/admin/reports", icon: <FileText size={18} /> });
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

function UserAvatar({ user, size = "md" }: { user: UserInfo; size?: "sm" | "md" }) {
  const initials = user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const dim = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  if (user.avatarUrl) {
    return (
      <Image
        src={user.avatarUrl}
        alt={user.name}
        width={size === "sm" ? 32 : 40}
        height={size === "sm" ? 32 : 40}
        className={`${dim} rounded-full object-cover ring-2 ring-[#EBA814]/30`}
      />
    );
  }
  return (
    <div className={`${dim} rounded-full bg-[#EBA814] flex items-center justify-center text-white font-bold ring-2 ring-[#EBA814]/30`}>
      {initials}
    </div>
  );
}

const roleLabel: Record<string, string> = {
  STUDENT: "Student",
  CLUB_OFFICER: "Club Officer",
  UNIVERSITY_ADMIN: "University Admin",
  SYSTEM_ADMIN: "System Admin",
};

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

  const logout = () => { clearAuthState(); router.push("/login"); };

  if (!user) return null;

  const navGroups = getNavGroups(user.role);

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside
      className={`flex flex-col h-full bg-white dark:bg-zinc-900 border-r border-gray-100 dark:border-zinc-800 transition-all duration-300 ${
        mobile ? "w-64" : collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center border-b border-gray-100 dark:border-zinc-800 ${collapsed && !mobile ? "justify-center px-2 py-5" : "gap-3 px-4 py-5"}`}>
        <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
          <LogoIcon size={36} />
        </div>
        {(!collapsed || mobile) && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight tracking-wide">
                CLUB <span className="text-[#EBA814]">CONNECT</span>
              </p>
              <p className="text-[9px] text-gray-400 dark:text-zinc-500">Connect. Collaborate. Create Impact.</p>
            </div>
            <NotificationBell />
          </>
        )}
      </div>

      {/* Search — hidden when collapsed */}
      {(!collapsed || mobile) && (
        <div className="px-3 pt-3 pb-1">
          <GlobalSearchBar />
        </div>
      )}

      {/* ⌘K hint when collapsed */}
      {collapsed && !mobile && (
        <div className="flex justify-center py-3">
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))}
            title="Open command palette (⌘K)"
            className="p-2 rounded-lg text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Command size={18} />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-4 overflow-y-auto">
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
      </nav>

      {/* Bottom: theme + collapse + user */}
      <div className={`border-t border-gray-100 dark:border-zinc-800 ${collapsed && !mobile ? "p-2" : "p-4"}`}>
        {collapsed && !mobile ? (
          <div className="flex flex-col items-center gap-2">
            <ThemeToggle />
            <button
              onClick={toggleCollapsed}
              title="Expand sidebar"
              className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <PanelLeftOpen size={16} />
            </button>
            <UserAvatar user={user} size="sm" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <ThemeToggle />
              <button
                onClick={toggleCollapsed}
                title="Collapse sidebar"
                className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
            <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
              <UserAvatar user={user} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.name}</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{roleLabel[user.role] ?? user.role}</p>
              </div>
              <button
                onClick={logout}
                title="Logout"
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-[#F8F9FA] dark:bg-zinc-950 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 z-50">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-zinc-400">
            <Menu size={20} />
          </button>
          <p className="text-sm font-bold text-gray-900 dark:text-white flex-1">
            CLUB <span className="text-[#EBA814]">CONNECT</span>
          </p>
          <ThemeToggle />
          <NotificationBell />
          <UserAvatar user={user} size="sm" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
