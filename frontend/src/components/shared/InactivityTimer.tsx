"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { clearAuthState, getAuthState } from "@/lib/tokenStorage";

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;   // 30 min
const WARNING_BEFORE_MS   = 2 * 60 * 1000;    // warn at 28 min

export default function InactivityTimer() {
  const router = useRouter();
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown]     = useState(120); // seconds
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const logout = useCallback(() => {
    clearAuthState();
    setShowWarning(false);
    router.push("/login");
  }, [router]);

  const resetTimer = useCallback(() => {
    // Don't run if user isn't authenticated
    if (!getAuthState()) return;

    setShowWarning(false);
    if (countdownRef.current) clearInterval(countdownRef.current);

    if (timerRef.current)   clearTimeout(timerRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    // Warning at 28 min
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(120);
      countdownRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }, INACTIVITY_LIMIT_MS - WARNING_BEFORE_MS);

    // Logout at 30 min
    timerRef.current = setTimeout(logout, INACTIVITY_LIMIT_MS);
  }, [logout]);

  useEffect(() => {
    // Only activate when authenticated
    if (!getAuthState()) return;

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (timerRef.current)    clearTimeout(timerRef.current);
      if (warningRef.current)  clearTimeout(warningRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [resetTimer]);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">⏱️</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Still there?</h2>
        <p className="text-gray-500 text-sm mb-6">
          You'll be logged out in{" "}
          <span className="font-bold text-[#EBA814]">{countdown}s</span> due to inactivity.
        </p>
        <div className="flex gap-3">
          <button
            onClick={logout}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors"
          >
            Logout now
          </button>
          <button
            onClick={resetTimer}
            className="flex-1 py-2.5 rounded-xl bg-[#EBA814] hover:bg-[#D99810] text-white font-semibold text-sm transition-colors shadow-[0_4px_14px_rgba(235,168,20,0.3)]"
          >
            Stay logged in
          </button>
        </div>
      </div>
    </div>
  );
}
