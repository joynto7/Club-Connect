"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setAuthState } from "@/lib/tokenStorage";
import { exchangeGoogleOAuthCode, getApiErrorMessage } from "@/lib/auth";
import { toast } from "sonner";

export default function GoogleOAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const error = searchParams.get("error");
    if (error) {
      const messages: Record<string, string> = {
        google_cancelled: "Google sign-in was cancelled.",
        account_suspended: "Your account has been suspended.",
        google_oauth_failed: "Google sign-in failed. Please try again.",
      };
      toast.error(messages[error] ?? "Sign-in failed. Please try again.");
      router.replace("/login");
      return;
    }

    const code = searchParams.get("code");
    if (!code) {
      toast.error("Sign-in failed — missing exchange code.");
      router.replace("/login");
      return;
    }

    exchangeGoogleOAuthCode(code)
      .then(({ accessToken, refreshToken, user }) => {
        setAuthState({ tokens: { accessToken, refreshToken }, user });
        toast.success(`Welcome, ${user.name}!`);
        router.replace("/dashboard");
      })
      .catch((err) => {
        toast.error(getApiErrorMessage(err));
        router.replace("/login");
      });
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-[#EBA814] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-600 font-medium">Completing sign-in…</p>
      </div>
    </div>
  );
}
