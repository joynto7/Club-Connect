"use client";

import { useRef, useState } from "react";
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";
import { getAuthState } from "@/lib/tokenStorage";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:5001";

type UploadType = "avatar" | "poster" | "banner" | "logo";

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  type: UploadType;
  label?: string;
}

export default function FileUpload({ value, onChange, type, label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const isAvatar = type === "avatar";

  async function handleFile(file: File) {
    if (!file) return;
    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const tokens = getAuthState()?.tokens;
      const res = await fetch(`${API_URL}/uploads?type=${type}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens?.accessToken ?? ""}` },
        body: formData,
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Upload failed");
      }

      const data = (await res.json()) as { url: string };
      onChange(data.url.startsWith("http") ? data.url : `${API_URL}${data.url}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  if (isAvatar) {
    return (
      <div className="flex flex-col items-center gap-2">
        {label && <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">{label}</p>}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-dashed border-gray-300 dark:border-zinc-600 hover:border-[#EBA814] transition-colors group"
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-zinc-800">
              <ImageIcon size={24} className="text-gray-400" />
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 size={20} className="text-white animate-spin" />
            </div>
          )}
          {!uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
              <Upload size={18} className="text-white" />
            </div>
          )}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-red-500 hover:underline"
          >
            Remove
          </button>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onInputChange} />
      </div>
    );
  }

  const aspectClass = type === "banner" ? "aspect-[18/5]" : "aspect-[16/9]";

  return (
    <div className="flex flex-col gap-1.5">
      {label && <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">{label}</p>}
      <div
        className={`relative w-full ${aspectClass} rounded-xl overflow-hidden border-2 border-dashed transition-colors cursor-pointer ${
          dragging
            ? "border-[#EBA814] bg-amber-50 dark:bg-amber-900/10"
            : "border-gray-200 dark:border-zinc-700 hover:border-[#EBA814]/60"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
            <ImageIcon size={32} />
            <p className="text-sm">Click or drag to upload</p>
            <p className="text-xs">JPG, PNG, WEBP · max 5MB</p>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 size={28} className="text-white animate-spin" />
          </div>
        )}

        {value && !uploading && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors"
          >
            <X size={14} className="text-white" />
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onInputChange} />
    </div>
  );
}
