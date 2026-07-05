"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyProfile, updateMyProfile, getApiErrorMessage } from "@/lib/auth";
import { setAuthState, getAuthState } from "@/lib/tokenStorage";
import { toast } from "sonner";
import FileUpload from "@/components/shared/FileUpload";
import { getMyPoints, getMyAchievements, levelLabel, pointsToNextLevel } from "@/lib/gamification";
import {
  User,
  Mail,
  Building2,
  GraduationCap,
  Tag,
  Pencil,
  Check,
  X,
  ShieldCheck,
  CalendarDays,
  Lock,
  Trophy,
} from "lucide-react";

const YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Masters", "PhD", "Other"];

const editSchema = z.object({
  name:       z.string().min(2, "Name must be at least 2 characters"),
  department: z.string().optional(),
  year:       z.string().optional(),
  interests:  z.string().optional(),
});

type EditFormValues = z.infer<typeof editSchema>;

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-gray-400 flex-shrink-0">{icon}</div>
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-gray-800 mt-0.5">{value || <span className="text-gray-400 italic font-normal">Not set</span>}</p>
      </div>
    </div>
  );
}

const roleBadge: Record<string, string> = {
  STUDENT:          "bg-blue-100 text-blue-700",
  CLUB_OFFICER:     "bg-purple-100 text-purple-700",
  UNIVERSITY_ADMIN: "bg-green-100 text-green-700",
  SYSTEM_ADMIN:     "bg-red-100 text-red-700",
};
const roleLabel: Record<string, string> = {
  STUDENT: "Student", CLUB_OFFICER: "Club Officer",
  UNIVERSITY_ADMIN: "University Admin", SYSTEM_ADMIN: "System Admin",
};

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["myProfile"],
    queryFn: () => getMyProfile(),
  });

  const { data: pointsData } = useQuery({
    queryKey: ["myPoints"],
    queryFn: getMyPoints,
  });

  const { data: achievementsData } = useQuery({
    queryKey: ["myAchievements"],
    queryFn: getMyAchievements,
  });

  const user = data?.user;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
  });

  // Sync form values when data loads
  useEffect(() => {
    if (user) {
      setAvatarUrl(user.avatarUrl ?? null);
      reset({
        name:       user.name,
        department: user.department ?? "",
        year:       user.year ?? "",
        interests:  (user.interests ?? []).join(", "),
      });
    }
  }, [user, reset]);

  const mutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess(data) {
      const auth = getAuthState();
      if (auth) setAuthState({ ...auth, user: { ...auth.user, ...data.user } });
      queryClient.setQueryData(["myProfile"], { user: data.user });
      toast.success("Profile updated successfully!");
      setEditing(false);
    },
    onError(err) {
      toast.error(getApiErrorMessage(err));
    },
  });

  const onSubmit = (values: EditFormValues) => {
    mutation.mutate({
      name:       values.name,
      department: values.department || undefined,
      year:       values.year || undefined,
      interests:  values.interests
        ? values.interests.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      avatarUrl:  avatarUrl ?? "",
    });
  };

  const avatarInitials = user?.name?.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) ?? "?";

  const pts = pointsData?.points ?? 0;
  const lvl = pointsData?.level ?? 1;
  const { next, progress } = pointsToNextLevel(lvl, pts);
  const achievements = achievementsData?.achievements ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        {!editing && (
          <button
            onClick={() => { setEditing(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-[#EBA814] hover:bg-[#D99810] text-white text-sm font-semibold rounded-xl transition-colors shadow-[0_4px_14px_rgba(235,168,20,0.25)]"
          >
            <Pencil size={14} /> Edit Profile
          </button>
        )}
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {/* Cover */}
        <div className="h-24 bg-gradient-to-r from-[#EBA814]/20 to-[#EBA814]/5" />

        {/* Avatar + name row */}
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-10 mb-5">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-20 h-20 rounded-2xl object-cover ring-4 ring-white shadow-md"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-[#EBA814] flex items-center justify-center text-white text-2xl font-bold ring-4 ring-white shadow-md">
                {avatarInitials}
              </div>
            )}
            {!isLoading && user && (
              <div className="pb-1">
                <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${roleBadge[user.role] ?? "bg-gray-100 text-gray-600"}`}>
                    {roleLabel[user.role] ?? user.role}
                  </span>
                  {user.emailVerified && (
                    <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                      <ShieldCheck size={12} /> Verified
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Info grid — view mode */}
          {!editing && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-gray-100">
              <InfoRow icon={<Mail size={16} />}       label="Email"      value={user?.email} />
              <InfoRow icon={<Building2 size={16} />}  label="Department" value={user?.department} />
              <InfoRow icon={<GraduationCap size={16}/>} label="Year"    value={user?.year} />
              <InfoRow
                icon={<CalendarDays size={16} />}
                label="Member since"
                value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : undefined}
              />
              <div className="sm:col-span-2">
                <InfoRow
                  icon={<Tag size={16} />}
                  label="Interests"
                  value={(user?.interests ?? []).length > 0 ? user?.interests?.join(", ") : undefined}
                />
              </div>
            </div>
          )}

          {/* Edit form */}
          {editing && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-2 border-t border-gray-100">
              {/* Name */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    {...register("name")}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814] transition-colors"
                  />
                </div>
                {errors.name && <span className="text-xs text-red-500 mt-1 block">{errors.name.message}</span>}
              </div>

              {/* Department + Year */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Department</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      {...register("department")}
                      placeholder="e.g. Computer Science"
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814] transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Year</label>
                  <div className="relative">
                    <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <select
                      {...register("year")}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814] transition-colors bg-white"
                    >
                      <option value="">Select year</option>
                      {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Interests */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Interests</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    {...register("interests")}
                    placeholder="e.g. Music, Coding, Sports (comma separated)"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814] transition-colors"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Separate multiple interests with commas</p>
              </div>

              {/* Avatar Upload */}
              <div className="flex flex-col items-start gap-2">
                <label className="block text-sm font-bold text-gray-700">Profile Picture <span className="font-normal text-gray-400">(optional)</span></label>
                <FileUpload type="avatar" value={avatarUrl} onChange={setAvatarUrl} />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setEditing(false); }}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <X size={16} /> Cancel
                </button>
                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="flex-1 py-3 bg-[#EBA814] hover:bg-[#D99810] text-white rounded-xl text-sm font-semibold transition-colors shadow-[0_4px_14px_rgba(235,168,20,0.25)] disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  <Check size={16} /> {mutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Badges & Points */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={18} className="text-[#EBA814]" />
          <h2 className="text-lg font-bold text-gray-900">Badges & Points</h2>
        </div>

        {/* XP bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">
              Level {lvl} · {levelLabel(lvl)}
            </span>
            <span className="text-sm font-semibold text-[#EBA814]">{pts} pts</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#EBA814] to-[#F5C842] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{next - pts} pts to Level {lvl + 1}</p>
        </div>

        {/* Achievements grid */}
        {achievements.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No achievements yet — start attending events!</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {achievements.map((a) => (
              <div
                key={a.slug}
                title={`${a.name}: ${a.description}${a.unlockedAt ? "\nUnlocked " + new Date(a.unlockedAt).toLocaleDateString() : ""}`}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                  a.unlocked
                    ? "border-[#EBA814]/40 bg-[#EBA814]/5"
                    : "border-gray-100 bg-gray-50 opacity-50 grayscale"
                }`}
              >
                <span className="text-2xl">{a.icon}</span>
                <p className="text-xs font-semibold text-gray-700 leading-tight">{a.name}</p>
                {!a.unlocked && <Lock size={10} className="text-gray-400" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
