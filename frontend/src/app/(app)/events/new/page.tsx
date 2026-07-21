"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createEvent, EVENT_CATEGORIES } from "@/lib/events";
import { listClubs } from "@/lib/clubs";
import { getApiErrorMessage, getMyClubs } from "@/lib/auth";
import { getAuthState } from "@/lib/tokenStorage";
import { toast } from "sonner";
import FileUpload from "@/components/shared/FileUpload";
import RichTextEditor from "@/components/shared/RichTextEditor";
import {
  ArrowLeft, Calendar, MapPin, Users,
  UserCircle, Send, AlertTriangle, Video, Link2, Sparkles, RotateCcw,
} from "lucide-react";
import Link from "next/link";

const schema = z.object({
  title:               z.string().min(3, "Title must be at least 3 characters"),
  location:            z.string().min(2, "Location is required"),
  clubId:              z.string().min(1, "Select a club"),
  category:            z.string().min(1, "Select a category"),
  startsAt:            z.string().min(1, "Start date is required"),
  endsAt:              z.string().optional(),
  capacity:            z.string().optional(),
  registrationDeadline:z.string().optional(),
  contactPerson:       z.string().optional(),
  maxWaitlist:         z.string().optional(),
  meetingUrl:          z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function Field({ label, required, error, children }: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export default function NewEventPage() {
  const router = useRouter();
  const auth   = getAuthState();
  const [description, setDescription] = useState("");
  const [posterUrl, setPosterUrl]   = useState<string | null>(null);
  const [isVirtual, setIsVirtual]   = useState(false);
  const [isPaid, setIsPaid]         = useState(false);
  const [ticketPrice, setTicketPrice] = useState("");
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiDone, setAiDone]         = useState(false);

  const isAdmin = auth?.user.role === "UNIVERSITY_ADMIN" || auth?.user.role === "SYSTEM_ADMIN";

  const { data: clubsData } = useQuery({
    queryKey: ["clubs"],
    queryFn: () => listClubs(),
    staleTime: 60_000,
    enabled: isAdmin,
  });
  const { data: myClubsData } = useQuery({
    queryKey: ["my-clubs"],
    queryFn: getMyClubs,
    staleTime: 60_000,
    enabled: !isAdmin,
  });

  const officerClubs = isAdmin
    ? (clubsData?.clubs ?? []).filter((c) => c.status === "ACTIVE")
    : (myClubsData?.clubs ?? []).filter((c) => c.role === "PRESIDENT" || c.role === "COORDINATOR");

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category: "General" },
  });

  async function generateWithAI() {
    const { title, category, location } = getValues();

    if (!title.trim()) { toast.error("Enter an event title first"); return; }

    setAiLoading(true);
    setAiDone(false);
    setDescription("");

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:5001";
      const { getAuthState } = await import("@/lib/tokenStorage");
      const token = getAuthState()?.tokens.accessToken ?? "";

      const resp = await fetch(`${apiBase}/ai/event-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, category, location }),
      });

      if (!resp.ok || !resp.body) throw new Error("AI request failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let built = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload) as { text?: string; error?: string };
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) {
              built += parsed.text;
              setDescription(built);
            }
          } catch { /* skip malformed chunks */ }
        }
      }

      setAiDone(true);
    } catch {
      toast.error("AI generation failed. Try again.");
    } finally {
      setAiLoading(false);
    }
  }

  const mutation = useMutation({
    mutationFn: (v: FormValues) =>
      createEvent({
        title:               v.title,
        description:         description || undefined,
        location:            v.location,
        clubId:              v.clubId,
        category:            v.category,
        startsAt:            new Date(v.startsAt).toISOString(),
        endsAt:              v.endsAt            ? new Date(v.endsAt).toISOString()            : undefined,
        capacity:            v.capacity          ? Number(v.capacity)          : undefined,
        registrationDeadline:v.registrationDeadline ? new Date(v.registrationDeadline).toISOString() : undefined,
        posterUrl:           posterUrl ?? undefined,
        contactPerson:       v.contactPerson      || undefined,
        maxWaitlist:         v.maxWaitlist        ? Number(v.maxWaitlist)        : undefined,
        isVirtual,
        meetingUrl:          isVirtual && v.meetingUrl ? v.meetingUrl : undefined,
        isPaid,
        ticketPrice:         isPaid && ticketPrice ? Math.round(Number(ticketPrice) * 100) : undefined,
      }),
    onSuccess(data) {
      toast.success("Event submitted for approval!");
      router.push(`/events/${data.event.id}`);
    },
    onError(err) {
      toast.error(getApiErrorMessage(err));
    },
  });

  const isOfficer = isAdmin || officerClubs.length > 0;

  if (!isOfficer) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <AlertTriangle size={40} className="text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-semibold">You must be a club officer to create events.</p>
        <Link href="/events" className="text-[#EBA814] text-sm hover:underline mt-2 block">← Back to Events</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/events" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to Events
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create Event</h1>
        <p className="text-sm text-gray-500 mt-1">
          Your event will be submitted for admin review before going public.
        </p>
      </div>

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="bg-white rounded-2xl shadow-sm p-6 space-y-5">

        {/* Title */}
        <Field label="Event Title" required error={errors.title?.message}>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              {...register("title")}
              placeholder="e.g. Annual Hackathon 2026"
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814]"
            />
          </div>
        </Field>

        {/* Club + Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Club" required error={errors.clubId?.message}>
            <select
              {...register("clubId")}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814] bg-white"
            >
              <option value="">Select a club...</option>
              {officerClubs.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Category" required error={errors.category?.message}>
            <select
              {...register("category")}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814] bg-white"
            >
              {EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-bold text-gray-700">Description</label>
            <button
              type="button"
              onClick={generateWithAI}
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors disabled:opacity-60"
            >
              {aiLoading ? (
                <>
                  <span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : aiDone ? (
                <><RotateCcw size={12} /> Regenerate</>
              ) : (
                <><Sparkles size={12} /> AI Assist</>
              )}
            </button>
          </div>
          <RichTextEditor
            value={description}
            onChange={(v) => { setDescription(v); setAiDone(false); }}
            placeholder="Tell attendees about the event..."
          />
        </div>

        {/* Location */}
        <Field label="Location" required error={errors.location?.message}>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              {...register("location")}
              placeholder="e.g. Main Hall, Building A"
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814]"
            />
          </div>
        </Field>

        {/* Virtual Event Toggle */}
        <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <div className="flex items-center gap-2">
            <Video size={16} className="text-blue-500" />
            <div>
              <p className="text-sm font-semibold text-gray-800">Virtual Event</p>
              <p className="text-xs text-gray-500">Online event with a meeting link</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsVirtual((v) => !v)}
            className={`relative w-10 h-6 rounded-full transition-colors ${isVirtual ? "bg-blue-500" : "bg-gray-200"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isVirtual ? "translate-x-4" : "translate-x-0"}`} />
          </button>
        </div>

        {isVirtual && (
          <Field label="Meeting URL">
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                {...register("meetingUrl")}
                placeholder="https://zoom.us/j/... or meet.google.com/..."
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814]"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Link is only shown to registered attendees when the event is live.</p>
          </Field>
        )}

        {/* Paid Event Toggle */}
        <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-100 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-amber-500 text-base">💳</span>
            <div>
              <p className="text-sm font-semibold text-gray-800">Paid Event</p>
              <p className="text-xs text-gray-500">Require a ticket purchase to register</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsPaid((v) => !v)}
            className={`relative w-10 h-6 rounded-full transition-colors ${isPaid ? "bg-[#EBA814]" : "bg-gray-200"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isPaid ? "translate-x-4" : "translate-x-0"}`} />
          </button>
        </div>

        {isPaid && (
          <Field label="Ticket Price (BDT)">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">৳</span>
              <input
                type="number"
                min="1"
                step="1"
                value={ticketPrice}
                onChange={(e) => setTicketPrice(e.target.value)}
                placeholder="500"
                className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814]"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Enter the price in Taka. Payment is processed via SSLCommerz (bKash, Nagad, Rocket, and cards).</p>
          </Field>
        )}

        {/* Start + End */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Start Date & Time" required error={errors.startsAt?.message}>
            <input
              type="datetime-local"
              {...register("startsAt")}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814]"
            />
          </Field>
          <Field label="End Date & Time" error={errors.endsAt?.message}>
            <input
              type="datetime-local"
              {...register("endsAt")}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814]"
            />
          </Field>
        </div>

        {/* Capacity + Waitlist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Capacity" error={errors.capacity?.message}>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="number"
                min="1"
                {...register("capacity")}
                placeholder="Leave blank for unlimited"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814]"
              />
            </div>
          </Field>
          <Field label="Max Waitlist Size" error={errors.maxWaitlist?.message}>
            <input
              type="number"
              min="0"
              {...register("maxWaitlist")}
              placeholder="Leave blank for no waitlist"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814]"
            />
          </Field>
        </div>

        {/* Registration Deadline */}
        <Field label="Registration Deadline" error={errors.registrationDeadline?.message}>
          <input
            type="datetime-local"
            {...register("registrationDeadline")}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814]"
          />
        </Field>

        {/* Contact Person */}
        <Field label="Contact Person" error={errors.contactPerson?.message}>
          <div className="relative">
            <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              {...register("contactPerson")}
              placeholder="Name or email"
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814]"
            />
          </div>
        </Field>

        {/* Event Poster */}
        <FileUpload
          type="poster"
          value={posterUrl}
          onChange={setPosterUrl}
          label="Event Poster (optional)"
        />

        {/* Info box */}
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700 leading-relaxed">
          <strong>What happens next?</strong> Your event will be submitted for admin review. Once approved, it will appear publicly and students can register.
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full py-3.5 bg-[#EBA814] hover:bg-[#D99810] text-white font-semibold rounded-xl transition-colors shadow-[0_4px_14px_rgba(235,168,20,0.25)] disabled:opacity-70 flex items-center justify-center gap-2"
        >
          <Send size={16} /> {mutation.isPending ? "Submitting..." : "Submit for Approval"}
        </button>
      </form>
    </div>
  );
}
