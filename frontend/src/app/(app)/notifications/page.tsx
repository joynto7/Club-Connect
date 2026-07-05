"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Trash2, ArrowRight } from "lucide-react";
import { SkeletonListRow } from "@/components/shared/Skeleton";
import EmptyState from "@/components/shared/EmptyState";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  notificationTypeIcon,
  type Notification,
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

function NotificationRow({
  notif,
  onRead,
  onDelete,
}: {
  notif: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();

  const handleClick = () => {
    if (!notif.read) onRead(notif.id);
    if (notif.link) router.push(notif.link);
  };

  return (
    <div className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${!notif.read ? "bg-[#EBA814]/5 border-[#EBA814]/20" : "bg-white border-gray-100"}`}>
      <span className="text-xl mt-0.5 flex-shrink-0">
        {notificationTypeIcon[notif.type] ?? "🔔"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className={`text-sm font-semibold ${!notif.read ? "text-gray-900" : "text-gray-700"}`}>
            {notif.title}
          </p>
          {!notif.read && <span className="w-2 h-2 rounded-full bg-[#EBA814] flex-shrink-0" />}
        </div>
        <p className="text-sm text-gray-600">{notif.message}</p>
        <p className="text-xs text-gray-400 mt-1">{timeAgo(notif.createdAt)}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {notif.link && (
          <button
            onClick={handleClick}
            className="p-1.5 rounded-lg text-[#EBA814] hover:bg-[#EBA814]/10 transition-colors"
            title="Go to link"
          >
            <ArrowRight size={15} />
          </button>
        )}
        <button
          onClick={() => onDelete(notif.id)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Delete"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
    refetchInterval: 30_000,
  });

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => readAllMutation.mutate()}
            disabled={readAllMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-[#EBA814]/10 text-[#EBA814] font-medium text-sm rounded-xl hover:bg-[#EBA814]/20 transition-colors disabled:opacity-50"
          >
            <CheckCheck size={16} />
            Mark all read
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <SkeletonListRow key={i} />)}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="All caught up!"
          description="You have no notifications right now."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <NotificationRow
              key={notif.id}
              notif={notif}
              onRead={(id) => readMutation.mutate(id)}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
