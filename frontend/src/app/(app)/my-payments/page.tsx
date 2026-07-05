"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyPayments } from "@/lib/events";
import Link from "next/link";
import { CreditCard, CheckCircle2, Clock, XCircle, ArrowLeft } from "lucide-react";

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  succeeded: { label: "Paid",    color: "text-green-700 bg-green-50",  icon: <CheckCircle2 size={13} /> },
  pending:   { label: "Pending", color: "text-yellow-700 bg-yellow-50", icon: <Clock size={13} /> },
  refunded:  { label: "Refunded",color: "text-gray-600 bg-gray-100",   icon: <XCircle size={13} /> },
};

export default function MyPaymentsPage() {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["my-payments"],
    queryFn: getMyPayments,
  });

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/my-bookings" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft size={18} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Payments</h1>
          <p className="text-sm text-gray-500">Ticket purchases and payment history</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <div className="py-20 text-center">
          <CreditCard size={48} className="text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No payments yet</p>
          <p className="text-sm text-gray-400 mt-1">Ticket purchases will appear here.</p>
          <Link href="/events" className="mt-4 inline-block text-sm text-[#EBA814] font-semibold hover:underline">
            Browse events →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => {
            const cfg = statusConfig[p.status] ?? statusConfig["pending"];
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CreditCard size={18} className="text-[#EBA814]" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/events/${p.event.id}`} className="text-sm font-semibold text-gray-900 hover:text-[#EBA814] transition-colors truncate block">
                    {p.event.title}
                  </Link>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p.event.club.name} · {new Date(p.event.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  <p className="text-xs text-gray-400">
                    Paid {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-base font-bold text-gray-900">
                    ${(p.amount / 100).toFixed(2)}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                    {cfg.icon} {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
