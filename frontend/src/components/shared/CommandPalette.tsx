"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, X, LayoutDashboard, Calendar, Users2, Building2,
  Package, BookMarked, User, History, Megaphone, Settings,
  Monitor, BarChart2, FileText, ShieldCheck, ArrowRight,
} from "lucide-react";
import { getAuthState } from "@/lib/tokenStorage";
import { globalSearch } from "@/lib/search";

type NavEntry = { label: string; href: string; icon: React.ReactNode; group: string };

const BASE_NAV: NavEntry[] = [
  { label: "Dashboard",       href: "/dashboard",              icon: <LayoutDashboard size={16} />, group: "Navigation" },
  { label: "Events",          href: "/events",                 icon: <Calendar size={16} />,        group: "Navigation" },
  { label: "Clubs",           href: "/clubs",                  icon: <Users2 size={16} />,          group: "Navigation" },
  { label: "Venues",          href: "/venues",                 icon: <Building2 size={16} />,       group: "Navigation" },
  { label: "Resources",       href: "/resources",              icon: <Package size={16} />,         group: "Navigation" },
  { label: "My Bookings",     href: "/my-bookings",            icon: <BookMarked size={16} />,      group: "Navigation" },
  { label: "My Profile",      href: "/profile",                icon: <User size={16} />,            group: "Navigation" },
  { label: "My Activities",   href: "/activities",             icon: <History size={16} />,         group: "Navigation" },
  { label: "Announcements",   href: "/announcements",          icon: <Megaphone size={16} />,       group: "Navigation" },
  { label: "Settings",        href: "/settings/notifications", icon: <Settings size={16} />,        group: "Navigation" },
  { label: "Sessions",        href: "/settings/sessions",      icon: <Monitor size={16} />,         group: "Navigation" },
];

const ADMIN_NAV: NavEntry[] = [
  { label: "Analytics",   href: "/analytics",     icon: <BarChart2 size={16} />,  group: "Admin" },
  { label: "Reports",     href: "/admin/reports", icon: <FileText size={16} />,   group: "Admin" },
  { label: "Admin Panel", href: "/admin",         icon: <ShieldCheck size={16} />, group: "Admin" },
];

type SearchResult = { type: string; id: string; title: string; subtitle?: string; href: string };

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const role = getAuthState()?.user?.role ?? "STUDENT";
  const allNav = role === "UNIVERSITY_ADMIN" || role === "SYSTEM_ADMIN"
    ? [...BASE_NAV, ...ADMIN_NAV]
    : BASE_NAV;

  const filteredNav = query.trim()
    ? allNav.filter((n) => n.label.toLowerCase().includes(query.toLowerCase()))
    : allNav.slice(0, 7);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim() || query.length < 2) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await globalSearch(query, "all");
        const mapped: SearchResult[] = [
          ...data.results.clubs.map((c) => ({
            type: "Club", id: c.id, title: c.name,
            subtitle: c.category, href: `/clubs/${c.slug ?? c.id}`,
          })),
          ...data.results.events.map((ev) => ({
            type: "Event", id: ev.id, title: ev.title,
            subtitle: ev.location, href: `/events/${ev.id}`,
          })),
        ];
        setResults(mapped);
      } catch { /* ignore */ } finally {
        setSearching(false);
      }
    }, 300);
  }, [query]);

  const allItems = [
    ...filteredNav.map((n) => ({ label: n.label, href: n.href, group: n.group, icon: n.icon })),
    ...results.map((r) => ({ label: r.title, href: r.href, group: r.type, icon: <Search size={16} /> })),
  ];

  const navigate = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, allItems.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && allItems[activeIndex]) navigate(allItems[activeIndex].href);
  };

  useEffect(() => { setActiveIndex(0); }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <Search size={18} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, clubs, events…"
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {searching && (
            <div className="px-4 py-3 text-sm text-gray-400 text-center">Searching…</div>
          )}
          {!searching && allItems.length === 0 && query.length > 1 && (
            <div className="px-4 py-8 text-sm text-gray-400 text-center">No results for "{query}"</div>
          )}

          {(() => {
            let lastGroup = "";
            return allItems.map((item, i) => {
              const showHeader = item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <div key={`${item.href}-${i}`}>
                  {showHeader && (
                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      {item.group}
                    </p>
                  )}
                  <button
                    onClick={() => navigate(item.href)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      i === activeIndex
                        ? "bg-[#EBA814]/10 text-[#EBA814]"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className={i === activeIndex ? "text-[#EBA814]" : "text-gray-400"}>
                      {item.icon}
                    </span>
                    <span className="flex-1 text-left">{item.label}</span>
                    <ArrowRight size={14} className={i === activeIndex ? "text-[#EBA814]" : "text-gray-300"} />
                  </button>
                </div>
              );
            });
          })()}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 text-[11px] text-gray-400">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span className="ml-auto"><kbd className="font-mono">⌘K</kbd> toggle</span>
        </div>
      </div>
    </div>
  );
}
