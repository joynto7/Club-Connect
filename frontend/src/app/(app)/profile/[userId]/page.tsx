"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Calendar, Users2, Star, Tag } from "lucide-react";
import { getUserProfile } from "@/lib/social";

export default function PublicProfilePage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-profile", userId],
    queryFn: () => getUserProfile(userId),
  });

  const user = data?.user;

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-700 p-8 animate-pulse">
          <div className="flex gap-5 mb-6">
            <div className="w-20 h-20 bg-gray-200 dark:bg-zinc-700 rounded-full" />
            <div className="space-y-3 flex-1">
              <div className="h-6 w-48 bg-gray-200 dark:bg-zinc-700 rounded" />
              <div className="h-4 w-32 bg-gray-100 dark:bg-zinc-800 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[1,2,3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 dark:bg-zinc-800 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center text-gray-500">
        <p>User not found</p>
        <Link href="/members" className="text-[#EBA814] text-sm mt-2 inline-block">
          Back to directory
        </Link>
      </div>
    );
  }

  const initials = user.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const memberSince = new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      {/* Back nav */}
      <Link
        href="/members"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
      >
        <ArrowLeft size={16} /> Back to Directory
      </Link>

      {/* Profile card */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl p-8">
        <div className="flex items-start gap-5 mb-6">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.name}
              width={80}
              height={80}
              className="w-20 h-20 rounded-full object-cover ring-4 ring-[#EBA814]/20"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#EBA814] flex items-center justify-center text-white font-bold text-2xl ring-4 ring-[#EBA814]/20">
              {initials}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{user.name}</h1>
            {(user.department || user.year) && (
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {[user.department, user.year].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-2">Member since {memberSince}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-[#EBA814] mb-1">
              <Calendar size={16} />
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {user._count.attendances}
              </span>
            </div>
            <p className="text-xs text-gray-500">Events attended</p>
          </div>
          <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-blue-500 mb-1">
              <Star size={16} />
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {user._count.feedbacks}
              </span>
            </div>
            <p className="text-xs text-gray-500">Reviews given</p>
          </div>
        </div>

        {/* Interests */}
        {user.interests.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Tag size={15} className="text-gray-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Interests</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {user.interests.map((interest: string) => (
                <span
                  key={interest}
                  className="text-sm bg-[#EBA814]/10 text-[#EBA814] px-3 py-1 rounded-full font-medium"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Clubs */}
        {user.memberships.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users2 size={15} className="text-gray-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
                Clubs ({user.memberships.length})
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {user.memberships.map((m: { role: string; club: { id: string; name: string; slug: string; logoUrl: string | null } }) => (
                <Link
                  key={m.club.id}
                  href={`/clubs/${m.club.slug}`}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl hover:bg-[#EBA814]/5 transition-colors"
                >
                  {m.club.logoUrl ? (
                    <Image
                      src={m.club.logoUrl}
                      alt={m.club.name}
                      width={36}
                      height={36}
                      className="w-9 h-9 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-[#EBA814]/10 flex items-center justify-center">
                      <Users2 size={16} className="text-[#EBA814]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{m.club.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{m.role.toLowerCase()}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
