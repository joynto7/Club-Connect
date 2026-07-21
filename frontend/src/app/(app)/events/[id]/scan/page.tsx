"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getEvent, scanTicket, type ScanResult } from "@/lib/events";
import { getMyClubs } from "@/lib/auth";
import { getAuthState } from "@/lib/tokenStorage";
import { ArrowLeft, CheckCircle2, XCircle, ScanLine, Keyboard } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const auth = getAuthState();

  const { data, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: () => getEvent(id),
  });

  const isAdmin = auth?.user.role === "UNIVERSITY_ADMIN" || auth?.user.role === "SYSTEM_ADMIN";
  const { data: myClubsData } = useQuery({
    queryKey: ["my-clubs"],
    queryFn: getMyClubs,
    enabled: !!auth && !isAdmin,
  });

  const [result, setResult]         = useState<ScanResult | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [scanning, setScanning]     = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [showManual, setShowManual] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannerDivId = "qr-reader";

  const isOfficer = isAdmin || (myClubsData?.clubs ?? []).some(
    (c) => c.id === data?.event.clubId && (c.role === "PRESIDENT" || c.role === "COORDINATOR")
  );

  async function processToken(token: string) {
    setResult(null);
    setError(null);
    try {
      const r = await scanTicket(id, token.trim());
      setResult(r);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Invalid or expired ticket";
      setError(msg);
    }
  }

  function startScanner() {
    if (scannerRef.current) return;
    const scanner = new Html5QrcodeScanner(
      scannerDivId,
      { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true },
      false
    );
    scanner.render(
      async (decodedText) => {
        await scanner.clear();
        scannerRef.current = null;
        setScanning(false);
        await processToken(decodedText);
      },
      () => {}
    );
    scannerRef.current = scanner;
    setScanning(true);
  }

  function stopScanner() {
    if (scannerRef.current) {
      void scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
  }

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  if (isLoading) {
    return <div className="max-w-md mx-auto h-40 bg-gray-100 rounded-2xl animate-pulse mt-6" />;
  }

  if (!auth || !isOfficer) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <p className="text-gray-500 font-semibold">Officers only.</p>
        <Link href={`/events/${id}`} className="text-[#EBA814] text-sm hover:underline mt-2 block">← Back to Event</Link>
      </div>
    );
  }

  const event = data?.event;

  return (
    <div className="max-w-md mx-auto space-y-5">
      <Link href={`/events/${id}/manage`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} /> Back to Manage
      </Link>

      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ScanLine size={20} className="text-[#EBA814]" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">QR Ticket Scanner</h1>
            {event && <p className="text-xs text-gray-400">{event.title}</p>}
          </div>
        </div>

        {/* Result flash */}
        {result && (
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${
            result.alreadyCheckedIn
              ? "bg-yellow-50 border-yellow-200"
              : "bg-green-50 border-green-200"
          }`}>
            <CheckCircle2 size={20} className={result.alreadyCheckedIn ? "text-yellow-500" : "text-green-600"} />
            <div>
              <p className={`text-sm font-bold ${result.alreadyCheckedIn ? "text-yellow-700" : "text-green-700"}`}>
                {result.alreadyCheckedIn ? "Already checked in" : "Check-in successful!"}
              </p>
              <p className="text-xs text-gray-500">{result.attendee.name}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <XCircle size={20} className="text-red-500" />
            <p className="text-sm font-semibold text-red-700">{error}</p>
          </div>
        )}

        {/* Camera scanner */}
        <div>
          {!scanning ? (
            <button
              onClick={startScanner}
              className="w-full py-3.5 bg-[#EBA814] hover:bg-[#D99810] text-white font-semibold rounded-xl transition-colors shadow-[0_4px_14px_rgba(235,168,20,0.25)]"
            >
              Start Camera Scanner
            </button>
          ) : (
            <div className="space-y-3">
              <div id={scannerDivId} className="overflow-hidden rounded-xl" />
              <button
                onClick={stopScanner}
                className="w-full py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
              >
                Stop Scanner
              </button>
            </div>
          )}
        </div>

        {/* Manual entry fallback */}
        <button
          onClick={() => setShowManual((v) => !v)}
          className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <Keyboard size={14} /> Manual token entry
        </button>

        {showManual && (
          <div className="flex gap-2">
            <input
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Paste ticket token..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/30 focus:border-[#EBA814]"
            />
            <button
              onClick={() => void processToken(manualToken)}
              disabled={!manualToken.trim()}
              className="px-4 py-2.5 bg-[#EBA814] text-white text-sm font-semibold rounded-xl disabled:opacity-50 hover:bg-[#D99810] transition-colors"
            >
              Scan
            </button>
          </div>
        )}

        <button
          onClick={() => { setResult(null); setError(null); setManualToken(""); stopScanner(); }}
          className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
