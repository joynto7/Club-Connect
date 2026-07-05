import type { LucideIcon } from "lucide-react";
import Link from "next/link";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  onAction?: () => void;
  actionLabel?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  onAction,
  actionLabel,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
          {Icon ? (
            <Icon size={32} className="text-gray-400 dark:text-zinc-500" />
          ) : (
            <svg
              width="32"
              height="32"
              viewBox="0 0 80 80"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-gray-400 dark:text-zinc-500"
            >
              <circle cx="40" cy="32" r="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path
                d="M22 60c0-9.941 8.059-18 18-18s18 8.059 18 18"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>
        <div className="absolute inset-0 rounded-full bg-gray-100 dark:bg-zinc-800 opacity-40 scale-150 blur-xl -z-10" />
      </div>

      <h3 className="text-base font-semibold text-gray-800 dark:text-zinc-200">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm text-gray-400 dark:text-zinc-500 max-w-xs leading-relaxed">
          {description}
        </p>
      )}

      {action && (
        <Link
          href={action.href}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#EBA814] text-white text-sm font-semibold hover:bg-[#d4980f] transition-colors shadow-sm"
        >
          {action.label}
        </Link>
      )}

      {onAction && actionLabel && (
        <button
          onClick={onAction}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#EBA814] text-white text-sm font-semibold hover:bg-[#d4980f] transition-colors shadow-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
