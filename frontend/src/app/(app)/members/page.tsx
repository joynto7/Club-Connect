"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Search, Users2 } from "lucide-react";
import { listUsers, type PublicUser } from "@/lib/social";
import { useDebouncedCallback } from "use-debounce";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

const DEPARTMENTS = [
  "All",
  "Computer Science", "Engineering", "Business", "Arts", "Sciences",
  "Medicine", "Law", "Education", "Social Sciences", "Other",
];
const YEARS = ["All", "1st Year", "2nd Year", "3rd Year", "4th Year", "Postgraduate"];

function UserCard({ user }: { user: PublicUser }) {
  const initials = user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <motion.div variants={item}>
      <Link
        href={`/profile/${user.id}`}
        className="flex flex-col bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl p-5 hover:border-[#EBA814]/40 hover:shadow-md transition-all group"
      >
        <div className="flex items-center gap-3 mb-3">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.name}
              width={48}
              height={48}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-[#EBA814]/20"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#EBA814] flex items-center justify-center text-white font-bold text-sm ring-2 ring-[#EBA814]/20">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white group-hover:text-[#EBA814] transition-colors truncate">
              {user.name}
            </p>
            {(user.department || user.year) && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {[user.department, user.year].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>

        {user.interests.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {user.interests.slice(0, 3).map((interest) => (
              <span
                key={interest}
                className="text-xs bg-[#EBA814]/10 text-[#EBA814] px-2 py-0.5 rounded-full font-medium"
              >
                {interest}
              </span>
            ))}
            {user.interests.length > 3 && (
              <span className="text-xs text-gray-400">+{user.interests.length - 3}</span>
            )}
          </div>
        )}

        {user.memberships.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-auto">
            {user.memberships.map((m) => (
              <span
                key={m.club.id}
                className="text-xs bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full"
              >
                {m.club.name}
              </span>
            ))}
          </div>
        )}
      </Link>
    </motion.div>
  );
}

export default function MembersPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [year, setYear] = useState("All");

  const debounce = useDebouncedCallback((val: string) => setDebouncedSearch(val), 350);

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
      debounce(e.target.value);
    },
    [debounce]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["members", debouncedSearch, department, year],
    queryFn: () =>
      listUsers({
        search: debouncedSearch || undefined,
        department: department === "All" ? undefined : department,
        year: year === "All" ? undefined : year,
      }),
    staleTime: 30000,
  });

  const users = data?.users ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#EBA814]/10 rounded-xl flex items-center justify-center">
          <Users2 size={20} className="text-[#EBA814]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Member Directory</h1>
          <p className="text-sm text-gray-500">Discover students across campus</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={handleSearch}
            placeholder="Search by name..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
          />
        </div>

        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
        >
          {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
        </select>

        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
        >
          {YEARS.map((y) => <option key={y}>{y}</option>)}
        </select>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl p-5 animate-pulse">
              <div className="flex gap-3 mb-3">
                <div className="w-12 h-12 bg-gray-200 dark:bg-zinc-700 rounded-full" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-zinc-700 rounded" />
                  <div className="h-3 w-1/2 bg-gray-100 dark:bg-zinc-800 rounded" />
                </div>
              </div>
              <div className="flex gap-1">
                <div className="h-5 w-16 bg-gray-100 dark:bg-zinc-800 rounded-full" />
                <div className="h-5 w-20 bg-gray-100 dark:bg-zinc-800 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users2 size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No members found</p>
          <p className="text-sm mt-1">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500">{users.length} member{users.length !== 1 ? "s" : ""} found</p>
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {users.map((user) => (
              <UserCard key={user.id} user={user} />
            ))}
          </motion.div>
        </>
      )}
    </div>
  );
}
