"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Users2,
  Calendar,
  Megaphone,
  MapPin,
  Clock,
  ArrowLeft,
  SlidersHorizontal,
} from "lucide-react";
import { globalSearch, type SearchResults, type SearchClub, type SearchEvent, type SearchAnnouncement } from "@/lib/search";

const TYPE_TABS = [
  { key: "all", label: "All" },
  { key: "clubs", label: "Clubs" },
  { key: "events", label: "Events" },
  { key: "announcements", label: "Announcements" },
] as const;

type TabKey = (typeof TYPE_TABS)[number]["key"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ClubCard({ club }: { club: SearchClub }) {
  return (
    <Link
      href={`/clubs/${club.slug}`}
      className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-[#EBA814]/30 hover:shadow-sm transition-all group"
    >
      <div className="w-12 h-12 rounded-xl bg-[#EBA814]/10 flex items-center justify-center flex-shrink-0 text-[#EBA814] font-bold text-lg group-hover:bg-[#EBA814]/20 transition-colors">
        {club.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{club.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{club.category} · {club.memberCount} members</p>
        {club.description && (
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{club.description}</p>
        )}
        {club.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {club.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function EventCard({ event }: { event: SearchEvent }) {
  const spotsLeft = event.capacity != null ? event.capacity - event.registeredCount : null;
  return (
    <Link
      href={`/events/${event.id}`}
      className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-[#EBA814]/30 hover:shadow-sm transition-all group"
    >
      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-400 group-hover:bg-blue-100 transition-colors">
        <Calendar size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{event.title}</p>
        <p className="text-xs text-[#EBA814] font-medium mt-0.5">{event.club.name}</p>
        <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Clock size={11} />{formatDate(event.startsAt)}</span>
          <span className="flex items-center gap-1"><MapPin size={11} />{event.location}</span>
        </div>
        {event.description && (
          <p className="text-sm text-gray-600 mt-1.5 line-clamp-2">{event.description}</p>
        )}
        {spotsLeft !== null && (
          <p className="text-xs text-gray-400 mt-1">
            {spotsLeft <= 0 ? "Full" : `${spotsLeft} spots left`}
          </p>
        )}
      </div>
      <span className="flex-shrink-0 px-2 py-1 bg-gray-100 text-gray-500 text-[10px] rounded-full self-start">
        {event.category}
      </span>
    </Link>
  );
}

function AnnouncementCard({ item }: { item: SearchAnnouncement }) {
  const priorityColors: Record<string, string> = {
    HIGH: "bg-red-100 text-red-700",
    NORMAL: "bg-gray-100 text-gray-600",
    LOW: "bg-blue-50 text-blue-600",
  };
  return (
    <Link
      href="/announcements"
      className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-[#EBA814]/30 hover:shadow-sm transition-all"
    >
      <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0 text-[#EBA814]">
        <Megaphone size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-900 truncate">{item.title}</p>
          <span className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] rounded-full font-medium ${priorityColors[item.priority] ?? priorityColors.NORMAL}`}>
            {item.priority}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {item.club?.name ?? "Global"} · {formatDate(item.publishedAt)}
        </p>
        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.content}</p>
      </div>
    </Link>
  );
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get("q") ?? "";
  const initialType = (searchParams.get("type") as TabKey) ?? "all";

  const [query, setQuery] = useState(initialQ);
  const [type, setType] = useState<TabKey>(initialType);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async (q: string, t: TabKey) => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const data = await globalSearch(q.trim(), t);
      setResults(data);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQ) doSearch(initialQ, type);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query, type);
    router.replace(`/search?q=${encodeURIComponent(query)}&type=${type}`);
  };

  const handleTypeChange = (t: TabKey) => {
    setType(t);
    doSearch(query, t);
    router.replace(`/search?q=${encodeURIComponent(query)}&type=${t}`);
  };

  const clubs = results?.results.clubs ?? [];
  const events = results?.results.events ?? [];
  const announcements = results?.results.announcements ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Search</h1>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clubs, events, announcements..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40 focus:border-[#EBA814]"
            autoFocus={!initialQ}
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2.5 bg-[#EBA814] text-white rounded-xl text-sm font-medium hover:bg-[#d4960f] transition-colors"
        >
          Search
        </button>
      </form>

      {/* Type filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleTypeChange(tab.key)}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
              type === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-gray-400 text-sm">Searching…</div>
      )}

      {/* Empty state */}
      {!loading && !results && query.length >= 2 && (
        <div className="text-center py-12">
          <Search size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No results found for "{query}"</p>
          <p className="text-sm text-gray-400 mt-1">Try a different search term or category</p>
        </div>
      )}

      {!loading && !results && query.length < 2 && (
        <div className="text-center py-12">
          <Search size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Type at least 2 characters to search</p>
        </div>
      )}

      {/* Results */}
      {!loading && results && (
        <div className="space-y-6">
          {results.total === 0 && (
            <div className="text-center py-12">
              <Search size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No results for "{results.query}"</p>
            </div>
          )}

          {clubs.length > 0 && (type === "all" || type === "clubs") && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Users2 size={16} className="text-[#EBA814]" />
                <h2 className="text-sm font-semibold text-gray-700">
                  Clubs <span className="text-gray-400 font-normal">({clubs.length})</span>
                </h2>
              </div>
              <div className="space-y-2">
                {clubs.map((c) => <ClubCard key={c.id} club={c} />)}
              </div>
              {type === "all" && clubs.length === 10 && (
                <button
                  type="button"
                  onClick={() => handleTypeChange("clubs")}
                  className="mt-2 text-sm text-[#EBA814] hover:underline"
                >
                  See more clubs →
                </button>
              )}
            </section>
          )}

          {events.length > 0 && (type === "all" || type === "events") && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={16} className="text-blue-500" />
                <h2 className="text-sm font-semibold text-gray-700">
                  Events <span className="text-gray-400 font-normal">({events.length})</span>
                </h2>
              </div>
              <div className="space-y-2">
                {events.map((e) => <EventCard key={e.id} event={e} />)}
              </div>
              {type === "all" && events.length === 10 && (
                <button
                  type="button"
                  onClick={() => handleTypeChange("events")}
                  className="mt-2 text-sm text-[#EBA814] hover:underline"
                >
                  See more events →
                </button>
              )}
            </section>
          )}

          {announcements.length > 0 && (type === "all" || type === "announcements") && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Megaphone size={16} className="text-amber-500" />
                <h2 className="text-sm font-semibold text-gray-700">
                  Announcements <span className="text-gray-400 font-normal">({announcements.length})</span>
                </h2>
              </div>
              <div className="space-y-2">
                {announcements.map((a) => <AnnouncementCard key={a.id} item={a} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
