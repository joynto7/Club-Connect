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
