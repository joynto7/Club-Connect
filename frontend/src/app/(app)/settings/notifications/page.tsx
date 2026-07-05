"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Settings, Save, Bell, Calendar, Users2, Package, Smartphone } from "lucide-react";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";

type PrefKey = keyof Omit<NotificationPreferences, "id" | "userId" | "createdAt" | "updatedAt">;

const PREF_ITEMS: { key: PrefKey; label: string; description: string; icon: React.ReactNode }[] = [
  {
    key: "eventUpdates",
    label: "Event Updates",
    description: "RSVP confirmations, waitlist promotions, event approval decisions, and cancellations.",
    icon: <Calendar size={18} />,
  },
  {
    key: "clubUpdates",
    label: "Club & Membership",
    description: "Club approval/rejection decisions and membership request outcomes.",
    icon: <Users2 size={18} />,
  },
  {
    key: "bookingUpdates",
    label: "Booking Decisions",
    description: "Venue and resource booking approvals and rejections.",
    icon: <Package size={18} />,
  },
  {
    key: "announcements",
    label: "Announcements",
    description: "Global and club-specific announcements from officers and admins.",
    icon: <Bell size={18} />,
  },
];

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-[#EBA814]" : "bg-gray-200"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}

export default function NotificationSettingsPage() {
  const qc = useQueryClient();
  const push = usePushNotifications();

  const { data, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: getNotificationPreferences,
  });

  const [local, setLocal] = useState<Partial<Record<PrefKey, boolean>>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.preferences) {
      const { eventUpdates, clubUpdates, bookingUpdates, announcements } = data.preferences;
      setLocal({ eventUpdates, clubUpdates, bookingUpdates, announcements });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-preferences"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const handleSave = () => mutation.mutate(local);

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto space-y-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#EBA814]/10 rounded-xl flex items-center justify-center">
          <Settings size={20} className="text-[#EBA814]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Notification Settings</h1>
          <p className="text-sm text-gray-500">Choose which notifications you receive.</p>
        </div>
      </div>

      {/* Push notifications card */}
      {push.isSupported && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 flex-shrink-0">
            <Smartphone size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Push Notifications</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {push.isSubscribed
                ? "You'll receive push alerts on this device even when the app is closed."
                : "Get instant push alerts on this device for important updates."}
            </p>
          </div>
          <button
            onClick={push.isSubscribed ? push.unsubscribe : push.subscribe}
            disabled={push.isLoading}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
              push.isSubscribed
                ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                : "bg-[#EBA814] text-white hover:bg-[#d4970e]"
            }`}
          >
            {push.isLoading ? "…" : push.isSubscribed ? "Disable" : "Enable"}
          </button>
        </div>
      )}

      {/* Preferences list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
        {PREF_ITEMS.map(({ key, label, description, icon }) => (
          <div key={key} className="flex items-center gap-4 px-5 py-4">
            <div className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center text-gray-500 flex-shrink-0">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            </div>
            <Toggle
              checked={local[key] ?? true}
              onChange={(v) => setLocal((prev) => ({ ...prev, [key]: v }))}
            />
          </div>
        ))}
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={mutation.isPending}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#EBA814] text-white font-semibold rounded-xl hover:bg-[#d4970e] transition-colors disabled:opacity-50"
        >
          <Save size={16} />
          {mutation.isPending ? "Saving…" : "Save preferences"}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
        {mutation.isError && (
          <span className="text-sm text-red-500">Failed to save. Please try again.</span>
        )}
      </div>
    </div>
  );
}
