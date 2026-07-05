"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, ShieldCheck, ShieldOff, QrCode, Key, Loader2 } from "lucide-react";
import { setup2FA, verify2FA, disable2FA, getApiErrorMessage } from "@/lib/auth";
import { api } from "@/lib/axios";
import { toast } from "sonner";

type Me = { twoFactorEnabled: boolean };

async function getMe(): Promise<Me> {
  const r = await api.get<Me>("/auth/me");
  return r.data;
}

function OTPInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={6}
      value={value}
      onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      placeholder="000000"
      className="w-full text-center text-2xl tracking-[0.5em] font-mono border-2 border-gray-200 dark:border-zinc-700 rounded-xl py-3 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:border-[#EBA814]"
    />
  );
}

export default function SecuritySettingsPage() {
  const qc = useQueryClient();
  const [step, setStep] = useState<"idle" | "setup" | "disable">("idle");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");

  const { data: me } = useQuery({
    queryKey: ["me-security"],
    queryFn: getMe,
  });

  const is2FAEnabled = me?.twoFactorEnabled ?? false;

  const setupMut = useMutation({
    mutationFn: setup2FA,
    onSuccess: (d) => {
      setQrDataUrl(d.qrDataUrl);
      setSecret(d.secret);
      setStep("setup");
      setCode("");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const verifyMut = useMutation({
    mutationFn: (token: string) => verify2FA(token),
    onSuccess: () => {
      toast.success("Two-factor authentication enabled");
      setStep("idle");
      setCode("");
      qc.invalidateQueries({ queryKey: ["me-security"] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const disableMut = useMutation({
    mutationFn: (token: string) => disable2FA(token),
    onSuccess: () => {
      toast.success("Two-factor authentication disabled");
      setStep("idle");
      setCode("");
      qc.invalidateQueries({ queryKey: ["me-security"] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-[#EBA814]/10">
          <Shield size={20} className="text-[#EBA814]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Security Settings</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Manage your account security and authentication</p>
        </div>
      </div>

      {/* 2FA Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {is2FAEnabled ? (
              <div className="p-2 rounded-xl bg-green-100 dark:bg-green-900/30">
                <ShieldCheck size={20} className="text-green-600 dark:text-green-400" />
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800">
                <ShieldOff size={20} className="text-gray-400" />
              </div>
            )}
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Two-Factor Authentication (TOTP)</h2>
              <p className="text-sm text-gray-500 dark:text-zinc-400">
                {is2FAEnabled
                  ? "Your account is protected with 2FA via an authenticator app."
                  : "Add an extra layer of security to your account."}
              </p>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${is2FAEnabled ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>
            {is2FAEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        {/* Idle state */}
        {step === "idle" && (
          <div className="mt-4">
            {is2FAEnabled ? (
              <button
                onClick={() => { setStep("disable"); setCode(""); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <ShieldOff size={16} /> Disable 2FA
              </button>
            ) : (
              <button
                onClick={() => setupMut.mutate()}
                disabled={setupMut.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#EBA814] text-white text-sm font-medium hover:bg-[#d49612] transition-colors disabled:opacity-60"
              >
                {setupMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
                {setupMut.isPending ? "Generating…" : "Enable 2FA"}
              </button>
            )}
          </div>
        )}

        {/* Setup step: show QR + verify */}
        {step === "setup" && (
          <div className="mt-4 space-y-5">
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
              <strong>Step 1:</strong> Open your authenticator app (Google Authenticator, Authy, etc.) and scan the QR code below.
            </div>

            <div className="flex flex-col items-center gap-4 py-2">
              {qrDataUrl && (
                <img src={qrDataUrl} alt="2FA QR Code" className="w-48 h-48 rounded-xl border-4 border-white shadow-md" />
              )}
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-zinc-400 mb-1">Or enter this secret manually:</p>
                <code className="text-xs font-mono bg-gray-100 dark:bg-zinc-800 px-3 py-1 rounded-lg text-gray-700 dark:text-zinc-300 break-all">
                  {secret}
                </code>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                <strong>Step 2:</strong> Enter the 6-digit code from your app to confirm setup
              </p>
              <OTPInput value={code} onChange={setCode} />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setStep("idle"); setCode(""); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-sm text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => verifyMut.mutate(code)}
                disabled={code.length < 6 || verifyMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-[#EBA814] text-white text-sm font-semibold hover:bg-[#d49612] transition-colors disabled:opacity-50"
              >
                {verifyMut.isPending ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Confirm & Enable"}
              </button>
            </div>
          </div>
        )}

        {/* Disable step: confirm with code */}
        {step === "disable" && (
          <div className="mt-4 space-y-5">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-200">
              Enter the 6-digit code from your authenticator app to disable 2FA.
            </div>
            <OTPInput value={code} onChange={setCode} />
            <div className="flex gap-3">
              <button
                onClick={() => { setStep("idle"); setCode(""); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-sm text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => disableMut.mutate(code)}
                disabled={code.length < 6 || disableMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {disableMut.isPending ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Disable 2FA"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info card */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 p-5">
        <div className="flex gap-3">
          <Key size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-semibold mb-1">About Two-Factor Authentication</p>
            <p>When enabled, you will need to enter a 6-digit code from your authenticator app every time you log in. This protects your account even if your password is compromised.</p>
            <p className="mt-2">Compatible apps: <strong>Google Authenticator</strong>, <strong>Authy</strong>, <strong>1Password</strong>, <strong>Microsoft Authenticator</strong>.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
