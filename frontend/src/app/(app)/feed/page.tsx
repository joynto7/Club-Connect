"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  Calendar, Megaphone, Bell, Users2, Rss,
} from "lucide-react";
import { getFeed, type FeedItem } from "@/lib/social";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

type FilterType = "all" | "NEW_EVENT" | "ANNOUNCEMENT" | "REMINDER" | "NEW_MEMBER";

const TABS: { label: string; value: FilterType }[] = [
  { label: "All",           value: "all" },
  { label: "Events",        value: "NEW_EVENT" },
  { label: "Announcements", value: "ANNOUNCEMENT" },
  { label: "Reminders",     value: "REMINDER" },
  { label: "Members",       value: "NEW_MEMBER" },
];

function feedIcon(type: FeedItem["type"]) {
  switch (type) {
    case "NEW_EVENT":    return <Calendar size={18} className="text-[#EBA814]" />;
    case "ANNOUNCEMENT": return <Megaphone size={18} className="text-blue-500" />;
    case "REMINDER":     return <Bell size={18} className="text-purple-500" />;
    case "NEW_MEMBER":   return <Users2 size={18} className="text-green-500" />;
  }
}

function feedBg(type: FeedItem["type"]) {
  switch (type) {
    case "NEW_EVENT":    return "bg-[#EBA814]/10";
    case "ANNOUNCEMENT": return "bg-blue-50 dark:bg-blue-900/20";
    case "REMINDER":     return "bg-purple-50 dark:bg-purple-900/20";
    case "NEW_MEMBER":   return "bg-green-50 dark:bg-green-900/20";
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function FeedCard({ feedItem }: { feedItem: FeedItem }) {
  return (
    <motion.div variants={item}>
      <Link
        href={feedItem.link}
        className="flex items-start gap-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl p-4 hover:border-[#EBA814]/40 hover:shadow-sm transition-all group"
      >
        {feedItem.image ? (
          <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
            <Image src={feedItem.image} alt={feedItem.title} fill className="object-cover" />
          </div>
        ) : (
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${feedBg(feedItem.type)}`}>
            {feedIcon(feedItem.type)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white text-sm group-hover:text-[#EBA814] transition-colors truncate">
            {feedItem.title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{feedItem.subtitle}</p>
          <p className="text-xs text-gray-400 mt-1">{timeAgo(feedItem.createdAt)}</p>
        </div>
        {feedItem.type === "NEW_EVENT" && (
          <span className="text-xs bg-[#EBA814]/10 text-[#EBA814] font-medium px-2 py-1 rounded-full flex-shrink-0">
            RSVP
          </span>
        )}
        {feedItem.type === "REMINDER" && (
          <span className="text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 font-medium px-2 py-1 rounded-full flex-shrink-0">
            Soon
          </span>
        )}
      </Link>
    </motion.div>
  );
}

export default function FeedPage() {
  const [filter, setFilter] = useState<FilterType>("all");

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ["activity-feed"],
    queryFn: getFeed,
    staleTime: 30000,
  });

  const items = filter === "all" ? allItems : allItems.filter((i) => i.type === filter);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#EBA814]/10 rounded-xl flex items-center justify-center">
          <Rss size={20} className="text-[#EBA814]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Activity Feed</h1>
          <p className="text-sm text-gray-500">Updates from your clubs and events</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === tab.value
                ? "bg-[#EBA814] text-white"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Feed items */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl p-4 flex gap-4 animate-pulse">
              <div className="w-12 h-12 bg-gray-200 dark:bg-zinc-700 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-gray-200 dark:bg-zinc-700 rounded" />
                <div className="h-3 w-1/2 bg-gray-100 dark:bg-zinc-800 rounded" />
                <div className="h-3 w-16 bg-gray-100 dark:bg-zinc-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Rss size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">
            {filter === "all" ? "Your feed is empty" : `No ${filter.toLowerCase().replace("_", " ")} items`}
          </p>
          <p className="text-sm mt-1">
            Join clubs and RSVP to events to see activity here.
          </p>
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
          {items.map((feedItem, idx) => (
            <FeedCard key={`${feedItem.id}-${idx}`} feedItem={feedItem} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
