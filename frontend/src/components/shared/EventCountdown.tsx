"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface Props {
  startsAt: string;
  endsAt?: string | null;
}

function formatDiff(ms: number): string {
  if (ms <= 0) return "";
  const totalSeconds = Math.floor(ms / 1000);
  const days    = Math.floor(totalSeconds / 86400);
  const hours   = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0)  return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export default function EventCountdown({ startsAt, endsAt }: Props) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    const tick = () => {
      const now    = Date.now();
      const start  = new Date(startsAt).getTime();
      const end    = endsAt ? new Date(endsAt).getTime() : null;

      if (end && now > end) {
        setDisplay("Ended");
        return;
      }
      if (now >= start) {
        setDisplay("Happening now!");
        return;
      }
      setDisplay(`Starts in ${formatDiff(start - now)}`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startsAt, endsAt]);

  if (!display) return null;

  const isNow    = display === "Happening now!";
  const isEnded  = display === "Ended";

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
        isNow   ? "text-green-600"
        : isEnded ? "text-gray-400"
        : "text-[#EBA814]"
      }`}
    >
      <Clock size={13} />
      {display}
    </span>
  );
}
