"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  getClub, getMembers, approveMembership, rejectMembership,
  updateMemberRole, removeMember, updateClub, CATEGORIES,
  type ClubMember, type ClubRole,
} from "@/lib/clubs";
import { getApiErrorMessage } from "@/lib/auth";
import FileUpload from "@/components/shared/FileUpload";
import RichTextEditor from "@/components/shared/RichTextEditor";
import {
  ArrowLeft, Users2, Clock, CheckCircle2, XCircle, Pencil,
  Trash2, ChevronDown, Save, Settings, BarChart2, Download, RefreshCw, PiggyBank, Webhook, Plus,
} from "lucide-react";
import { generateReport } from "@/lib/reports";
import {
  listIntegrations, upsertIntegration, deleteIntegration,
  INTEGRATION_EVENT_LABELS, type ClubIntegration, type IntegrationEvent,
} from "@/lib/integrations";
import { toast } from "sonner";

type Tab = "members" | "pending" | "edit" | "integrations";

// Edit form schema (logo/banner/description managed outside react-hook-form)
const editSchema = z.object({
  name:         z.string().min(2),
  category:     z.string(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  tags:         z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

function useNotice() {
  const [notice, setNotice] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const notify = (type: "success" | "error", msg: string) => {
    setNotice({ type, msg });
    setTimeout(() => setNotice(null), 3000);
  };
  return { notice, notify };
}

// ── Pending requests tab ─────────────────────────────────────────────────────
function PendingTab({ clubId, notify, invalidateClub }: {
  clubId: string;
  notify: (t: "success" | "error", m: string) => void;
  invalidateClub: () => void;
}) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["members-pending", clubId] });
    invalidateClub();
  };

  const { data, isLoading } = useQuery({
    queryKey: ["members-pending", clubId],
    queryFn: () => getMembers(clubId, "PENDING"),
  });

  const approve = useMutation({
    mutationFn: (userId: string) => approveMembership(clubId, userId),
    onSuccess(d) { notify("success", d.message); invalidate(); },
    onError(e)   { notify("error", getApiErrorMessage(e)); },
  });
  const reject = useMutation({
    mutationFn: (userId: string) => rejectMembership(clubId, userId),
    onSuccess(d) { notify("success", d.message); invalidate(); },
    onError(e)   { notify("error", getApiErrorMessage(e)); },
  });

  const pending = data?.memberships ?? [];

  return isLoading ? (
    <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
  ) : pending.length === 0 ? (
    <div className="text-center py-12">
      <Clock size={32} className="text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500 text-sm font-medium">No pending requests</p>
    </div>
  ) : (
    <div className="space-y-3">
      {pending.map((m) => {
        const initials = m.user.name.split(" ").map((w:string) => w[0]).join("").toUpperCase().slice(0,2);
        return (
          <div key={m.id} className="flex items-center gap-4 p-4 bg-[#FAFAFA] rounded-xl border border-gray-100">
            <div className="w-10 h-10 rounded-full bg-[#EBA814] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{m.user.name}</p>
              <p className="text-xs text-gray-400 truncate">{m.user.email}</p>
              {m.message && <p className="text-xs text-gray-500 mt-0.5 italic">"{m.message}"</p>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => reject.mutate(m.user.id)}
                disabled={reject.isPending}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                title="Reject"
              >
                <XCircle size={16} />
              </button>
              <button
                onClick={() => approve.mutate(m.user.id)}
                disabled={approve.isPending}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-colors"
                title="Approve"
              >
                <CheckCircle2 size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Members tab ──────────────────────────────────────────────────────────────
function MembersTab({ clubId, notify }: {
  clubId: string;
  notify: (t: "success" | "error", m: string) => void;
}) {
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["members-all", clubId] });

  const handleExport = async (format: "CSV" | "PDF") => {
    setExporting(true);
    try {
      await generateReport({ type: "MEMBERS", format, clubId });
    } catch (e) {
      notify("error", (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["members-all", clubId],
    queryFn: () => getMembers(clubId, "APPROVED"),
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: ClubRole }) => updateMemberRole(clubId, userId, role),
    onSuccess(d) { notify("success", d.message); invalidate(); },
    onError(e)   { notify("error", getApiErrorMessage(e)); },
  });
  const remove = useMutation({
    mutationFn: (userId: string) => removeMember(clubId, userId),
    onSuccess(d) { notify("success", d.message); invalidate(); },
    onError(e)   { notify("error", getApiErrorMessage(e)); },
  });

  const members = data?.memberships ?? [];

  return isLoading ? (
    <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
  ) : members.length === 0 ? (
    <div className="text-center py-12">
      <Users2 size={32} className="text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500 text-sm font-medium">No approved members yet</p>
    </div>
  ) : (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-500 font-medium">{members.length} approved member{members.length !== 1 ? "s" : ""}</p>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport("CSV")}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-colors disabled:opacity-50"
          >
            {exporting ? <RefreshCw size={11} className="animate-spin" /> : <Download size={11} />}
            CSV
          </button>
          <button
            onClick={() => handleExport("PDF")}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors disabled:opacity-50"
          >
            {exporting ? <RefreshCw size={11} className="animate-spin" /> : <Download size={11} />}
            PDF
          </button>
        </div>
      </div>
      {members.map((m: ClubMember) => {
        const initials = m.user.name.split(" ").map((w:string) => w[0]).join("").toUpperCase().slice(0,2);
        return (
          <div key={m.id} className="flex items-center gap-4 p-4 bg-[#FAFAFA] rounded-xl border border-gray-100">
            <div className="w-10 h-10 rounded-full bg-[#EBA814] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{m.user.name}</p>
              <p className="text-xs text-gray-400 truncate">{m.user.department ?? m.user.email}</p>
            </div>
            {/* Role selector */}
            <div className="relative">
              <select
                value={m.role}
                onChange={(e) => changeRole.mutate({ userId: m.user.id, role: e.target.value as ClubRole })}
                className="appearance-none text-xs font-semibold px-3 py-1.5 pr-7 rounded-lg border border-gray-200 bg-white outline-none focus:border-[#EBA814] cursor-pointer"
              >
                <option value="MEMBER">Member</option>
                <option value="COORDINATOR">Coordinator</option>
                <option value="PRESIDENT">President</option>
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <button
              onClick={() => { if (confirm(`Remove ${m.user.name} from club?`)) remove.mutate(m.user.id); }}
              disabled={remove.isPending}
              className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors flex-shrink-0"
              title="Remove member"
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Edit club tab ─────────────────────────────────────────────────────────────
function EditTab({ club, notify }: { club: any; notify: (t: "success" | "error", m: string) => void }) {
  const qc = useQueryClient();
  const [description, setDescription] = useState<string>(club.description ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(club.logoUrl ?? null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(club.bannerUrl ?? null);

  const { register, handleSubmit, formState: { errors } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name:         club.name,
      category:     club.category,
      contactEmail: club.contactEmail ?? "",
      tags:         (club.tags ?? []).join(", "),
    },
  });

  const mutation = useMutation({
    mutationFn: (values: EditForm) =>
      updateClub(club.id, {
        name:         values.name,
        description:  description || undefined,
        category:     values.category,
        contactEmail: values.contactEmail || undefined,
        tags:         values.tags ? values.tags.split(",").map((t:string) => t.trim()).filter(Boolean) : [],
        logoUrl:      logoUrl  ?? undefined,
        bannerUrl:    bannerUrl ?? undefined,
      }),
    onSuccess(d) {
      notify("success", d.message);
      qc.invalidateQueries({ queryKey: ["club", club.slug] });
    },
    onError(e) { notify("error", getApiErrorMessage(e)); },
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">Club Name</label>
          <input {...register("name")} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814]" />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">Category</label>
          <select {...register("category")} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814] bg-white">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1.5">Description</label>
        <RichTextEditor value={description} onChange={setDescription} placeholder="Describe your club..." />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">Contact Email</label>
          <input {...register("contactEmail")} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814]" />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">Tags (comma separated)</label>
          <input {...register("tags")} placeholder="coding, AI, sports" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814]" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FileUpload type="logo" value={logoUrl} onChange={setLogoUrl} label="Club Logo" />
        <FileUpload type="banner" value={bannerUrl} onChange={setBannerUrl} label="Club Banner" />
      </div>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full py-3 bg-[#EBA814] hover:bg-[#D99810] text-white font-semibold rounded-xl transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
      >
        <Save size={16} /> {mutation.isPending ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}

// ── Integrations tab ──────────────────────────────────────────────────────────
function IntegrationsTab({ clubId }: { clubId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<"SLACK" | "DISCORD">("SLACK");
  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<IntegrationEvent[]>(["NEW_EVENT"]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: integrations = [], isLoading } = useQuery<ClubIntegration[]>({
    queryKey: ["integrations", clubId],
    queryFn: () => listIntegrations(clubId),
  });

  const toggleEvent = (ev: IntegrationEvent) => {
    setFormEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    );
  };

  const handleSave = async () => {
    if (!formUrl) { toast.error("Webhook URL is required"); return; }
    if (formEvents.length === 0) { toast.error("Select at least one event"); return; }
    setSaving(true);
    try {
      await upsertIntegration(clubId, { type: formType, webhookUrl: formUrl, events: formEvents });
      await qc.invalidateQueries({ queryKey: ["integrations", clubId] });
      toast.success("Integration saved");
      setShowForm(false);
      setFormUrl("");
      setFormEvents(["NEW_EVENT"]);
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? "Failed to save integration");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteIntegration(clubId, id);
      await qc.invalidateQueries({ queryKey: ["integrations", clubId] });
      toast.success("Integration removed");
    } catch {
      toast.error("Failed to remove integration");
    } finally {
      setDeletingId(null);
    }
  };

  const EVENTS = Object.entries(INTEGRATION_EVENT_LABELS) as [IntegrationEvent, string][];

  if (isLoading) return <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Slack / Discord Webhooks</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Get notified in Slack or Discord when club events happen.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#EBA814] text-white text-sm font-semibold rounded-xl hover:bg-[#D99810] transition-colors"
        >
          <Plus size={14} /> Add Integration
        </button>
      </div>

      {showForm && (
        <div className="border border-gray-200 rounded-xl p-5 space-y-4 bg-gray-50">
          <div className="grid grid-cols-2 gap-3">
            {(["SLACK", "DISCORD"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFormType(t)}
                className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                  formType === t
                    ? "border-[#EBA814] bg-amber-50 text-[#EBA814]"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                {t === "SLACK" ? "🟣 Slack" : "🔵 Discord"}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Webhook URL</label>
            <input
              type="url"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder={formType === "SLACK" ? "https://hooks.slack.com/services/..." : "https://discord.com/api/webhooks/..."}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#EBA814]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Notify on</label>
            <div className="flex flex-wrap gap-2">
              {EVENTS.map(([ev, label]) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => toggleEvent(ev)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    formEvents.includes(ev)
                      ? "bg-[#EBA814] border-[#EBA814] text-white"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 bg-[#EBA814] text-white text-sm font-semibold rounded-xl hover:bg-[#D99810] disabled:opacity-60 transition-colors"
            >
              {saving ? "Saving…" : "Save Integration"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {integrations.length === 0 && !showForm && (
        <div className="text-center py-12 text-gray-400">
          <Webhook size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No integrations configured yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {integrations.map((integration) => (
          <div key={integration.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
            <div className="flex items-center gap-3">
              <span className="text-xl">{integration.type === "SLACK" ? "🟣" : "🔵"}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800">{integration.type}</p>
                <p className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{integration.webhookUrl}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {integration.events.map((ev) => (
                    <span key={ev} className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-semibold rounded-full">
                      {INTEGRATION_EVENT_LABELS[ev as IntegrationEvent]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleDelete(integration.id)}
              disabled={deletingId === integration.id}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ManageClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
  const { notice, notify } = useNotice();

  const { data, isLoading } = useQuery({
    queryKey: ["club", slug],
    queryFn: () => getClub(slug),
  });
  const club = data?.club;

  const invalidateClub = () => qc.invalidateQueries({ queryKey: ["club", slug] });

  const tabs: { id: Tab; label: string }[] = [
    { id: "pending",      label: "Pending Requests" },
    { id: "members",      label: "Members"          },
    { id: "edit",         label: "Edit Club Info"   },
    { id: "integrations", label: "Integrations"     },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href={`/clubs/${slug}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to {club?.name ?? "Club"}
        </Link>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Settings size={20} className="text-[#EBA814]" />
            <h1 className="text-2xl font-bold text-gray-900">Manage {club?.name ?? "Club"}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/clubs/${slug}/budget`}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <PiggyBank size={14} /> Budget
            </Link>
            <Link
              href={`/clubs/${slug}/analytics`}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <BarChart2 size={14} /> Analytics
            </Link>
          </div>
        </div>
      </div>

      {notice && (
        <div className={`p-3 rounded-xl text-sm border flex items-center gap-2 ${
          notice.type === "success" ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-700 border-red-100"
        }`}>
          {notice.type === "success" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {notice.msg}
        </div>
      )}

      {isLoading ? (
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
      ) : !club ? (
        <p className="text-gray-500 text-center py-16">Club not found.</p>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm">
          {/* Tab bar */}
          <div className="flex border-b border-gray-100 px-4">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-4 text-sm font-semibold border-b-2 transition-colors ${
                  tab === t.id
                    ? "border-[#EBA814] text-[#EBA814]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-6">
            {tab === "pending"      && <PendingTab      clubId={club.id} notify={notify} invalidateClub={invalidateClub} />}
            {tab === "members"      && <MembersTab      clubId={club.id} notify={notify} />}
            {tab === "edit"         && <EditTab         club={club}      notify={notify} />}
            {tab === "integrations" && <IntegrationsTab clubId={club.id} />}
          </div>
        </div>
      )}
    </div>
  );
}
