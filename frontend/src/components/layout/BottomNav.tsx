"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, Users2, Bell, User } from "lucide-react";
import { useEffect, useState } from "react";
import { getNotifications } from "@/lib/notifications";

const tabs = [
  { label: "Home",    href: "/dashboard",     icon: LayoutDashboard },
  { label: "Events",  href: "/events",        icon: Calendar },
  { label: "Clubs",   href: "/clubs",         icon: Users2 },
  { label: "Alerts",  href: "/notifications", icon: Bell },
  { label: "Profile", href: "/profile",       icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    getNotifications()
      .then((d) => setUnread(d.unreadCount))
      .catch(() => {});
  }, []);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 flex items-stretch safe-area-pb">
      {tabs.map(({ label, href, icon: Icon }) => {
        const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
        const isNotif = href === "/notifications";
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors relative ${
              isActive
                ? "text-[#EBA814]"
                : "text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
            }`}
          >
            <span className="relative">
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
              {isNotif && unread > 0 && (
                <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </span>
            {label}
            {isActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-[#EBA814]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
