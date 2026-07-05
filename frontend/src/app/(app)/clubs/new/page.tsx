"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { createClub, CATEGORIES } from "@/lib/clubs";
import { getApiErrorMessage } from "@/lib/auth";
import FileUpload from "@/components/shared/FileUpload";
import RichTextEditor from "@/components/shared/RichTextEditor";
import {
  Users2, Tag, Mail, Link2, ArrowLeft, Send,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const schema = z.object({
  name:         z.string().min(2, "Club name must be at least 2 characters"),
  category:     z.string().min(1, "Select a category"),
  contactEmail: z.string().email("Enter a valid email").optional().or(z.literal("")),
  tags:         z.string().optional(),
  website:      z.string().url("Enter a valid URL").optional().or(z.literal("")),
  instagram:    z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewClubPage() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [descError, setDescError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category: "General" },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const plainText = description.replace(/<[^>]*>/g, "").trim();
      if (plainText.length < 10) {
        setDescError("Please write at least 10 characters");
        throw new Error("Description too short");
      }
      return createClub({
        name:         values.name,
        description,
        category:     values.category,
        contactEmail: values.contactEmail || undefined,
        tags:         values.tags ? values.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        socialLinks: {
          ...(values.website   ? { website:   values.website }   : {}),
          ...(values.instagram ? { instagram: values.instagram } : {}),
        },
        logoUrl:   logoUrl  ?? undefined,
        bannerUrl: bannerUrl ?? undefined,
      });
    },
    onSuccess(data) {
      toast.success("Club request submitted! Awaiting admin approval.");
      router.push(`/clubs/${data.club.slug}?submitted=1`);
    },
    onError(err) {
      const msg = getApiErrorMessage(err);
      if (msg !== "Description too short") toast.error(msg);
    },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link href="/clubs" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to Clubs
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Request New Club</h1>
        <p className="text-sm text-gray-500 mt-1">
          Fill in the details below. Your request will be reviewed by an administrator.
        </p>
      </div>

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-5 bg-white rounded-2xl shadow-sm p-6">

        {/* Club Name */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">Club Name <span className="text-red-500">*</span></label>
          <div className="relative">
            <Users2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              {...register("name")}
              placeholder="e.g. Robotics Club"
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814] transition-colors"
            />
          </div>
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">Category <span className="text-red-500">*</span></label>
          <select
            {...register("category")}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814] bg-white transition-colors"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category.message}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">Description <span className="text-red-500">*</span></label>
          <RichTextEditor
            value={description}
            onChange={(html) => { setDescription(html); setDescError(null); }}
            placeholder="Describe your club's mission, activities, and what members can expect..."
          />
          {descError && <p className="text-xs text-red-500 mt-1">{descError}</p>}
        </div>

        {/* Contact Email */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">Contact Email <span className="text-gray-400 font-normal">(optional)</span></label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              {...register("contactEmail")}
              placeholder="club@university.edu"
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814] transition-colors"
            />
          </div>
          {errors.contactEmail && <p className="text-xs text-red-500 mt-1">{errors.contactEmail.message}</p>}
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">
            Tags <span className="text-gray-400 font-normal">(optional, comma separated)</span>
          </label>
          <div className="relative">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              {...register("tags")}
              placeholder="e.g. coding, AI, robotics"
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814] transition-colors"
            />
          </div>
        </div>

        {/* Social Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Website</label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                {...register("website")}
                placeholder="https://..."
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814] transition-colors"
              />
            </div>
            {errors.website && <p className="text-xs text-red-500 mt-1">{errors.website.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Instagram</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">@</span>
              <input
                {...register("instagram")}
                placeholder="username"
                className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814] transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Logo + Banner uploads */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FileUpload type="logo" value={logoUrl} onChange={setLogoUrl} label="Club Logo (optional)" />
          <FileUpload type="banner" value={bannerUrl} onChange={setBannerUrl} label="Club Banner (optional)" />
        </div>

        {/* Info box */}
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700 leading-relaxed">
          <strong>What happens next?</strong> Your club request will be sent to a university administrator for review.
          You'll be notified once it's approved or rejected. Upon approval, you'll automatically become the club president.
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full py-3.5 bg-[#EBA814] hover:bg-[#D99810] text-white font-semibold rounded-xl transition-colors shadow-[0_4px_14px_rgba(235,168,20,0.25)] disabled:opacity-70 flex items-center justify-center gap-2"
        >
          <Send size={16} /> {mutation.isPending ? "Submitting..." : "Submit Club Request"}
        </button>
      </form>
    </div>
  );
}
