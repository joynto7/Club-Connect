"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { globalSearch, type SearchResults } from "@/lib/search";

export default function GlobalSearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults(null);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const data = await globalSearch(q.trim());
      setResults(data);
      setOpen(true);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const clearQuery = () => {
    setQuery("");
    setResults(null);
    setOpen(false);
    inputRef.current?.focus();
  };

  const hasResults =
    results &&
    (results.results.clubs.length > 0 ||
      results.results.events.length > 0 ||
      results.results.announcements.length > 0);

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <form onSubmit={handleSubmit} className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results) setOpen(true); }}
          placeholder="Search..."
          className="w-full pl-8 pr-7 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40 focus:border-[#EBA814] placeholder:text-gray-400 transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={clearQuery}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={13} />
          </button>
        )}
      </form>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-50 max-h-80 overflow-y-auto">
          {loading && (
            <p className="px-4 py-3 text-xs text-gray-400">Searching…</p>
          )}

          {!loading && !hasResults && query.length >= 2 && (
            <p className="px-4 py-3 text-xs text-gray-500">No results found for "{query}"</p>
          )}

          {!loading && hasResults && (
            <>
              {results!.results.clubs.length > 0 && (
                <Section title="Clubs">
                  {results!.results.clubs.slice(0, 3).map((c) => (
                    <DropdownItem
                      key={c.id}
                      label={c.name}
                      sub={c.category}
                      href={`/clubs/${c.slug}`}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </Section>
              )}

              {results!.results.events.length > 0 && (
                <Section title="Events">
                  {results!.results.events.slice(0, 3).map((e) => (
                    <DropdownItem
                      key={e.id}
                      label={e.title}
                      sub={e.club.name}
                      href={`/events/${e.id}`}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </Section>
              )}

              {results!.results.announcements.length > 0 && (
                <Section title="Announcements">
                  {results!.results.announcements.slice(0, 2).map((a) => (
                    <DropdownItem
                      key={a.id}
                      label={a.title}
                      sub={a.club?.name ?? "Global"}
                      href="/announcements"
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </Section>
              )}

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(`/search?q=${encodeURIComponent(query.trim())}`);
                }}
                className="w-full text-left px-4 py-2.5 text-xs text-[#EBA814] font-medium hover:bg-amber-50 border-t border-gray-100"
              >
                See all results for "{query}" →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
        {title}
      </p>
      {children}
    </div>
  );
}

function DropdownItem({
  label,
  sub,
  href,
  onNavigate,
}: {
  label: string;
  sub: string;
  href: string;
  onNavigate: () => void;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => { onNavigate(); router.push(href); }}
      className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
    >
      <p className="text-sm font-medium text-gray-800 truncate">{label}</p>
      <p className="text-xs text-gray-400 truncate">{sub}</p>
    </button>
  );
}
