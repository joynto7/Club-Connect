"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion, type Variants } from "framer-motion";
import { listClubs, CATEGORIES, type Club } from "@/lib/clubs";
import { Search, Users2, Plus, ArrowRight } from "lucide-react";
import { getAuthState } from "@/lib/tokenStorage";
import { SkeletonClubCard } from "@/components/shared/Skeleton";
import EmptyState from "@/components/shared/EmptyState";

function ClubCard({ club }: { club: Club }) {
  const initials = club.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group">
      {/* Banner / header */}
      <div className="h-20 bg-gradient-to-br from-[#EBA814]/20 to-[#EBA814]/5 relative flex-shrink-0">
        {club.bannerUrl && (
          <img src={club.bannerUrl} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute -bottom-6 left-4">
          {club.logoUrl ? (
            <img
              src={club.logoUrl}
              alt={club.name}
              className="w-12 h-12 rounded-xl object-cover ring-2 ring-white shadow-md"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-[#EBA814] text-white font-bold text-sm flex items-center justify-center ring-2 ring-white shadow-md">
              {initials}
            </div>
          )}
        </div>
      </div>

      <div className="pt-8 px-4 pb-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-sm font-bold text-gray-900 line-clamp-1">{club.name}</h3>
          <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EBA814]/10 text-[#EBA814]">
            {club.category}
          </span>
        </div>
        <p className="text-xs text-gray-500 line-clamp-2 flex-1 mb-3">
          {club.description || "No description provided."}
        </p>

        <div className="flex items-center justify-between mt-auto">
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Users2 size={12} />
            {club._count?.memberships ?? 0} members
          </span>
          <Link
            href={`/clubs/${club.slug}`}
            className="flex items-center gap-1 text-xs font-semibold text-[#EBA814] hover:underline group-hover:gap-2 transition-all"
          >
            View <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.28 } },
};
const gridVariants: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.06 } },
};

export default function ClubsPage() {
  const [search, setSearch]     = useState("");
  const [category, setCategory] = useState("All");
  const auth = getAuthState();

  const { data, isLoading } = useQuery({
    queryKey: ["clubs", search, category],
    queryFn: () => listClubs({ search: search || undefined, category }),
    staleTime: 30_000,
  });

  const clubs = data?.clubs ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Club Directory</h1>
          <p className="text-sm text-gray-500 mt-0.5">Discover and join clubs that match your interests</p>
        </div>
        {auth && (
          <Link
            href="/clubs/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#EBA814] hover:bg-[#D99810] text-white text-sm font-semibold rounded-xl transition-colors shadow-[0_4px_14px_rgba(235,168,20,0.25)]"
          >
            <Plus size={16} /> Request Club
          </Link>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clubs by name or description..."
          className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814] transition-colors shadow-sm"
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {["All", ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              category === cat
                ? "bg-[#EBA814] text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 hover:border-[#EBA814] hover:text-[#EBA814]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Results count */}
      {!isLoading && (
        <p className="text-xs text-gray-400 font-medium">
          {clubs.length} club{clubs.length !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonClubCard key={i} />)}
        </div>
      ) : clubs.length === 0 ? (
        <EmptyState
          icon={Users2}
          title={search ? `No clubs found for "${search}"` : "No clubs yet"}
          description="Be the first to create one!"
          action={{ label: "Request a Club", href: "/clubs/new" }}
        />
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={gridVariants}
          initial="hidden"
          animate="show"
        >
          {clubs.map((club) => (
            <motion.div key={club.id} variants={cardVariants}>
              <ClubCard club={club} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
