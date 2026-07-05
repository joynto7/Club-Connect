"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClub, requestMembership, removeMember, type ClubMember } from "@/lib/clubs";
import { getApiErrorMessage } from "@/lib/auth";
import { getAuthState } from "@/lib/tokenStorage";
import {
  ArrowLeft, Users2, Mail, Globe, Tag, Settings,
  UserPlus, UserCheck, Clock, UserMinus, CheckCircle2, XCircle,
  Calendar, MapPin, ArrowRight, Heart, MessageSquare,
} from "lucide-react";
import { listEvents, type Event as ClubEvent } from "@/lib/events";
import ReportContentButton from "@/components/shared/ReportContentButton";
import RichTextDisplay from "@/components/shared/RichTextDisplay";
import { followClub, unfollowClub } from "@/lib/social";

const roleColors: Record<string, string> = {
  PRESIDENT:   "bg-yellow-100 text-yellow-700",
  COORDINATOR: "bg-blue-100 text-blue-700",
  MEMBER:      "bg-gray-100 text-gray-600",
};

function MemberCard({ m }: { m: ClubMember }) {
  const initials = m.user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="flex items-center gap-3 p-3 bg-[#FAFAFA] rounded-xl">
      {m.user.avatarUrl ? (
        <img src={m.user.avatarUrl} alt={m.user.name} className="w-9 h-9 rounded-full object-cover" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-[#EBA814] flex items-center justify-center text-white text-xs font-bold">
          {initials}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{m.user.name}</p>
        <p className="text-xs text-gray-400 truncate">{m.user.department ?? "—"}</p>
      </div>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${roleColors[m.role]}`}>
        {m.role}
      </span>
    </div>
  );
}

function ClubEventCard({ event }: { event: ClubEvent }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="flex items-center gap-4 p-3.5 bg-[#FAFAFA] rounded-xl hover:bg-[#EBA814]/5 transition-colors group"
    >
      <div className="w-10 h-10 rounded-xl bg-[#EBA814]/10 flex items-center justify-center flex-shrink-0">
        <Calendar size={16} className="text-[#EBA814]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 truncate">{event.title}</p>
        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
          <span className="flex items-center gap-1">
            <Calendar size={10} />
            {new Date(event.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <span className="flex items-center gap-1">
            <MapPin size={10} /> {event.location}
          </span>
        </div>
      </div>
      <ArrowRight size={14} className="text-gray-300 group-hover:text-[#EBA814] transition-colors flex-shrink-0" />
    </Link>
  );
}

export default function ClubProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const auth = getAuthState();
  const [joinMsg, setJoinMsg]   = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [notice, setNotice]     = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["club", slug],
    queryFn: () => getClub(slug),
  });

  const club         = data?.club;
  const myMembership = data?.myMembership ?? null;
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const followerCount = (club as any)?._count?.followers ?? 0;

  // Sync follow state when data loads
  useEffect(() => {
    if (data?.isFollowing !== undefined) setIsFollowing(data.isFollowing as boolean);
  }, [data?.isFollowing]);

  const { data: eventsData } = useQuery({
    queryKey: ["club-events", club?.id],
    queryFn: () => listEvents({ clubId: club!.id, date: "upcoming" }),
    enabled: !!club?.id,
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["club", slug] });
  const notify = (type: "success" | "error", msg: string) => {
    setNotice({ type, msg });
    setTimeout(() => setNotice(null), 3000);
  };

  const joinMutation = useMutation({
    mutationFn: () => requestMembership(club!.id, joinMsg || undefined),
    onSuccess(d) { notify("success", d.message); setShowJoin(false); invalidate(); },
    onError(e)   { notify("error", getApiErrorMessage(e)); },
  });

  const leaveMutation = useMutation({
    mutationFn: () => removeMember(club!.id, auth!.user.id),
    onSuccess(d) { notify("success", d.message); invalidate(); },
    onError(e)   { notify("error", getApiErrorMessage(e)); },
  });

  const isOfficer  = myMembership?.role === "PRESIDENT" || myMembership?.role === "COORDINATOR";
  const isAdmin    = auth?.user.role === "UNIVERSITY_ADMIN" || auth?.user.role === "SYSTEM_ADMIN";
  const canManage  = isOfficer || isAdmin;
  const officers   = (club?.memberships ?? []).filter((m) => m.role !== "MEMBER");
  const members    = (club?.memberships ?? []).filter((m) => m.role === "MEMBER");

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-gray-500 font-semibold">Club not found.</p>
        <Link href="/clubs" className="text-[#EBA814] text-sm hover:underline mt-2 block">← Back to clubs</Link>
      </div>
    );
  }

  const initials = club.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const social = club.socialLinks as Record<string, string>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <Link href="/clubs" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} /> Back to Clubs
      </Link>

      {notice && (
        <div className={`p-3 rounded-xl text-sm border flex items-center gap-2 ${
          notice.type === "success" ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-700 border-red-100"
        }`}>
          {notice.type === "success" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {notice.msg}
        </div>
      )}

      {/* Club header card */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {/* Banner */}
        <div className="h-32 bg-gradient-to-br from-[#EBA814]/25 to-[#EBA814]/5 relative">
          {club.bannerUrl && (
            <img src={club.bannerUrl} alt="" className="w-full h-full object-cover" />
          )}
        </div>

        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-8 mb-5">
            {club.logoUrl ? (
              <img src={club.logoUrl} alt={club.name}
                className="w-20 h-20 rounded-2xl object-cover ring-4 ring-white shadow-md flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-[#EBA814] text-white text-2xl font-bold flex items-center justify-center ring-4 ring-white shadow-md flex-shrink-0">
                {initials}
              </div>
            )}

            <div className="flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{club.name}</h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#EBA814]/10 text-[#EBA814]">
                  {club.category}
                </span>
                {club.status !== "ACTIVE" && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {club.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
                <span className="flex items-center gap-1"><Users2 size={11} /> {club._count?.memberships ?? 0} members</span>
                <span className="flex items-center gap-1"><Heart size={11} /> {followerCount} followers</span>
                {club.contactEmail && (
                  <a href={`mailto:${club.contactEmail}`} className="flex items-center gap-1 hover:text-[#EBA814]">
                    <Mail size={11} /> {club.contactEmail}
                  </a>
                )}
                {social?.website && (
                  <a href={social.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-[#EBA814]">
                    <Globe size={11} /> Website
                  </a>
                )}
                {social?.instagram && (
                  <a href={`https://instagram.com/${social.instagram}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-[#EBA814]">
                    <span className="text-[10px] font-bold">IG</span> @{social.instagram}
                  </a>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 flex-shrink-0 flex-wrap">
              {canManage && (
                <Link
                  href={`/clubs/${club.slug}/manage`}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Settings size={14} /> Manage
                </Link>
              )}
              {auth && club.status === "ACTIVE" && (
                <button
                  onClick={async () => {
                    try {
                      if (isFollowing) {
                        await unfollowClub(club.id);
                        setIsFollowing(false);
                      } else {
                        await followClub(club.id);
                        setIsFollowing(true);
                      }
                    } catch { /* silent */ }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-sm font-semibold transition-colors ${
                    isFollowing
                      ? "border-[#EBA814]/40 bg-[#EBA814]/10 text-[#EBA814]"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Heart size={14} className={isFollowing ? "fill-[#EBA814]" : ""} />
                  {isFollowing ? "Following" : "Follow"}
                </button>
              )}
              <Link
                href={`/clubs/${club.slug}/discuss`}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <MessageSquare size={14} /> Discuss
              </Link>
              {auth && club.status === "ACTIVE" && (
                <>
                  {!myMembership && (
                    <button
                      onClick={() => setShowJoin(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#EBA814] hover:bg-[#D99810] text-white text-sm font-semibold rounded-xl transition-colors shadow-[0_4px_14px_rgba(235,168,20,0.2)]"
                    >
                      <UserPlus size={14} /> Join Club
                    </button>
                  )}
                  {myMembership?.status === "PENDING" && (
                    <span className="flex items-center gap-1.5 px-4 py-2 bg-yellow-50 text-yellow-700 text-sm font-semibold rounded-xl border border-yellow-200">
                      <Clock size={14} /> Request Pending
                    </span>
                  )}
                  {myMembership?.status === "APPROVED" && !isOfficer && (
                    <button
                      onClick={() => { if (confirm("Leave this club?")) leaveMutation.mutate(); }}
                      disabled={leaveMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                    >
                      <UserMinus size={14} /> Leave Club
                    </button>
                  )}
                  {myMembership?.status === "APPROVED" && (
                    <span className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 text-sm font-semibold rounded-xl border border-green-200">
                      <UserCheck size={14} /> {myMembership.role}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Description */}
          {club.description && (
            <div className="mb-4">
              <RichTextDisplay html={club.description} className="text-gray-600" />
            </div>
          )}

          {/* Tags */}
          {club.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {club.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full">
                  <Tag size={10} /> {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Join modal */}
      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Join {club.name}</h3>
            <p className="text-sm text-gray-500 mb-4">Optionally tell the officers why you want to join.</p>
            <textarea
              value={joinMsg}
              onChange={(e) => setJoinMsg(e.target.value)}
              placeholder="Why do you want to join? (optional)"
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814] resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowJoin(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending}
                className="flex-1 py-2.5 bg-[#EBA814] hover:bg-[#D99810] text-white text-sm font-semibold rounded-xl disabled:opacity-70">
                {joinMutation.isPending ? "Sending..." : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Officers + Members */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Officers */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users2 size={16} className="text-[#EBA814]" /> Officers ({officers.length})
          </h2>
          {officers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No officers assigned yet</p>
          ) : (
            <div className="space-y-2">
              {officers.map((m) => <MemberCard key={m.id} m={m} />)}
            </div>
          )}
        </div>

        {/* Members */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users2 size={16} className="text-gray-400" /> Members ({members.length})
          </h2>
          {members.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No members yet</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {members.map((m) => <MemberCard key={m.id} m={m} />)}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming events */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Calendar size={16} className="text-[#EBA814]" /> Upcoming Events
          </h2>
          <Link href={`/events?clubId=${club.id}`} className="text-xs font-semibold text-[#EBA814] hover:underline">
            View all
          </Link>
        </div>
        {!eventsData ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : (eventsData.events ?? []).length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No upcoming events.</p>
        ) : (
          <div className="space-y-2">
            {(eventsData.events ?? []).slice(0, 5).map((e) => (
              <ClubEventCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </div>

      {/* Report content link */}
      {auth && (
        <div className="flex justify-end">
          <ReportContentButton targetType="CLUB" targetId={club.id} targetName={club.name} />
        </div>
      )}
    </div>
  );
}
