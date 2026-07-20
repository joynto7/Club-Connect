"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/axios";
import { getApiErrorMessage, resendVerification } from "@/lib/auth";
import LogoIcon from "@/components/shared/LogoIcon";

export default function VerifyEmail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");

  const verifyMutation = useMutation({
    mutationFn: () => api.post<{ message: string }>("/auth/verify-email", { email, code }).then((r) => r.data),
    onSuccess(data) {
      toast.success(data.message);
      router.push("/login");
    },
    onError(error) {
      toast.error(getApiErrorMessage(error));
    },
  });

  const resendMutation = useMutation({
    mutationFn: resendVerification,
    onSuccess(data) {
      toast.success(data.message);
    },
    onError(error) {
      toast.error(getApiErrorMessage(error));
    },
  });

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4 sm:p-8 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-100 p-8 sm:p-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl shadow-sm overflow-hidden mb-3">
            <LogoIcon size={56} />
          </div>
          <h1 className="text-lg font-bold text-gray-900 tracking-wide">
            CLUB <span className="text-[#EBA814]">CONNECT</span>
          </h1>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-1 text-center">
          Verify <span className="text-[#EBA814]">Your Email</span>
        </h2>
        <p className="text-gray-500 mb-8 text-sm text-center font-medium">
          Enter the 6-digit code we sent to your email address.
        </p>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm outline-none transition-colors focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814]"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Verification Code</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="w-full text-center text-2xl tracking-[0.5em] font-mono border-2 border-gray-200 rounded-xl py-3 bg-white text-gray-900 focus:outline-none focus:border-[#EBA814]"
            />
          </div>

          <button
            type="button"
            onClick={() => verifyMutation.mutate()}
            disabled={verifyMutation.isPending || code.length !== 6 || !email}
            className="w-full py-3.5 bg-[#EBA814] hover:bg-[#D99810] text-white font-semibold rounded-xl transition-all shadow-[0_6px_20px_rgba(235,168,20,0.3)] disabled:opacity-70"
          >
            {verifyMutation.isPending ? "Verifying…" : "Verify Email"}
          </button>

          <button
            type="button"
            onClick={() => resendMutation.mutate({ email })}
            disabled={resendMutation.isPending || !email}
            className="w-full text-sm font-semibold text-[#EBA814] hover:underline disabled:opacity-60"
          >
            {resendMutation.isPending ? "Sending…" : "Resend code"}
          </button>
        </div>

        <p className="text-center mt-8 text-sm font-medium text-gray-500">
          Already verified? <Link href="/login" className="text-[#EBA814] font-bold hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
}
