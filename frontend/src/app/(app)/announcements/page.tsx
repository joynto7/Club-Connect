"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Megaphone, Plus, Trash2, X, AlertTriangle, Info } from "lucide-react";
import { getAuthState } from "@/lib/tokenStorage";
import { getMyClubs } from "@/lib/auth";
import RichTextEditor from "@/components/shared/RichTextEditor";
import RichTextDisplay from "@/components/shared/RichTextDisplay";
import {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  priorityColors,
  type Announcement,
} from "@/lib/notifications";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const PRIORITY_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  LOW:    { label: "Low",    icon: <Info size={13} /> },
  NORMAL: { label: "Normal", icon: <Info size={13} /> },
  HIGH:   { label: "High",   icon: <AlertTriangle size={13} /> },
  URGENT: { label: "Urgent", icon: <AlertTriangle size={13} /> },
};

function AnnouncementCard({
  ann,
  canDelete,
  onDelete,
}: {
  ann: Announcement;
  canDelete: boolean;
  onDelete: (id: string) => void;
}) {
  const pMeta = PRIORITY_LABELS[ann.priority] ?? PRIORITY_LABELS.NORMAL;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${priorityColors[ann.priority] ?? priorityColors.NORMAL}`}>
            {pMeta.icon}
            {pMeta.label}
          </span>
          {ann.club && (
            <span className="text-xs bg-purple-50 text-purple-700 font-semibold px-2.5 py-0.5 rounded-full">
              {ann.club.name}
            </span>
          )}
          {!ann.club && (
            <span className="text-xs bg-gray-100 text-gray-600 font-semibold px-2.5 py-0.5 rounded-full">
              Global
            </span>
          )}
        </div>
        {canDelete && (
          <button
            onClick={() => onDelete(ann.id)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
            title="Delete announcement"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
      <div>
        <h3 className="font-semibold text-gray-900">{ann.title}</h3>
        <RichTextDisplay html={ann.content} className="text-gray-600 mt-1" />
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span>By {ann.createdBy.name}</span>
        <span>·</span>
        <span>{timeAgo(ann.publishedAt)}</span>
      </div>
    </div>
  );
}

function CreateModal({
  myClubs,
  isAdmin,
  onClose,
  onCreated,
}: {
  myClubs: { id: string; name: string; role: string }[];
  isAdmin: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle]       = useState("");
  const [content, setContent]   = useState("");
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [clubId, setClubId]     = useState<string>("");
  const [error, setError]       = useState("");

  const mutation = useMutation({
    mutationFn: createAnnouncement,
    onSuccess: () => { onCreated(); onClose(); },
    onError: (e: Error) => setError(e.message),
  });

  const officerClubs = myClubs.filter(
    (c) => c.role === "PRESIDENT" || c.role === "COORDINATOR"
  );

  const canPost = isAdmin || officerClubs.length > 0;

  const handleSubmit = () => {
    const plainContent = content.replace(/<[^>]*>/g, "").trim();
    if (!title.trim() || !plainContent) { setError("Title and content are required."); return; }
    if (!isAdmin && !clubId) { setError("Please select a club for this announcement."); return; }
    mutation.mutate({ title, content, priority, clubId: clubId || undefined });
  };

  if (!canPost) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
          <p className="text-gray-600 text-center">Only admins and club officers can post announcements.</p>
          <button onClick={onClose} className="mt-4 w-full py-2.5 bg-gray-100 rounded-xl text-sm font-medium">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">New Announcement</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcement title"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Content *</label>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Write your announcement…"
              minHeight={100}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            {(isAdmin || officerClubs.length > 0) && (
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Audience</label>
                <select
                  value={clubId}
                  onChange={(e) => setClubId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
                >
                  {isAdmin && <option value="">Everyone (Global)</option>}
                  {officerClubs.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl text-sm hover:bg-gray-200 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="flex-1 py-2.5 bg-[#EBA814] text-white font-semibold rounded-xl text-sm hover:bg-[#d4970e] transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AnnouncementsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const authState = getAuthState();
  const user = authState?.user;
  const isAdmin = user?.role === "UNIVERSITY_ADMIN" || user?.role === "SYSTEM_ADMIN";

  const { data: annData, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: getAnnouncements,
    refetchInterval: 60_000,
  });

  const { data: clubsData } = useQuery({
    queryKey: ["my-clubs"],
    queryFn: getMyClubs,
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAnnouncement,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });

  const announcements = annData?.announcements ?? [];
  const myClubs = (clubsData?.clubs ?? []).map((c) => ({ id: c.id, name: c.name, role: c.role }));

  const canCreate = isAdmin || myClubs.some((c) => c.role === "PRESIDENT" || c.role === "COORDINATOR");

  const canDelete = (ann: Announcement) =>
    isAdmin || ann.createdById === user?.id;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-sm text-gray-500 mt-0.5">Updates from your clubs and the university</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#EBA814] text-white font-semibold text-sm rounded-xl hover:bg-[#d4970e] transition-colors"
          >
            <Plus size={16} />
            New
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-36 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Megaphone size={28} className="text-gray-300" />
          </div>
          <h3 className="text-gray-900 font-semibold">No announcements yet</h3>
          <p className="text-gray-500 text-sm mt-1">Check back later for updates from your clubs.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((ann) => (
            <AnnouncementCard
              key={ann.id}
              ann={ann}
              canDelete={canDelete(ann)}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateModal
          myClubs={myClubs}
          isAdmin={isAdmin}
          onClose={() => setShowCreate(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["announcements"] })}
        />
      )}
    </div>
  );
}
