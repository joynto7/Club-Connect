"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getClubBudget, addBudgetTransaction, deleteBudgetTransaction, allocateBudget,
  formatCurrency, type BudgetTransaction,
} from "@/lib/budget";
import { getClub } from "@/lib/clubs";
import { getAuthState } from "@/lib/tokenStorage";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/auth";
import {
  ArrowLeft, Plus, Trash2, TrendingUp, TrendingDown, DollarSign,
  PiggyBank, ReceiptText, Upload, ChevronDown, ChevronUp,
} from "lucide-react";
import FileUpload from "@/components/shared/FileUpload";

export default function ClubBudgetPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const auth = getAuthState();
  const qc = useQueryClient();
  const isAdmin = auth?.user.role === "UNIVERSITY_ADMIN" || auth?.user.role === "SYSTEM_ADMIN";

  const [showAddModal, setShowAddModal]     = useState(false);
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [txType, setTxType]                 = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [txDesc, setTxDesc]                 = useState("");
  const [txAmount, setTxAmount]             = useState("");
  const [txReceipt, setTxReceipt]           = useState<string | null>(null);
  const [allocAmount, setAllocAmount]       = useState("");
  const [allocYear, setAllocYear]           = useState("2026");
  const [expandedTx, setExpandedTx]         = useState<string | null>(null);

  const { data: clubData } = useQuery({
    queryKey: ["club", slug],
    queryFn: () => getClub(slug),
  });

  const club = clubData?.club;

  const { data: budget, isLoading } = useQuery({
    queryKey: ["budget", club?.id],
    queryFn: () => getClubBudget(club!.id),
    enabled: !!club?.id,
  });

  const isOfficer = club && auth && (() => {
    const m = (club as any).myMembership;
    return (
      isAdmin ||
      (m?.status === "APPROVED" && (m?.role === "PRESIDENT" || m?.role === "COORDINATOR"))
    );
  })();

  const addMutation = useMutation({
    mutationFn: () =>
      addBudgetTransaction(club!.id, {
        description: txDesc,
        amount: Math.round(Number(txAmount) * 100),
        type: txType,
        receiptUrl: txReceipt ?? undefined,
      }),
    onSuccess() {
      toast.success("Transaction added.");
      setShowAddModal(false);
      setTxDesc(""); setTxAmount(""); setTxReceipt(null);
      void qc.invalidateQueries({ queryKey: ["budget", club?.id] });
    },
    onError(e) { toast.error(getApiErrorMessage(e)); },
  });

  const deleteMutation = useMutation({
    mutationFn: (txId: string) => deleteBudgetTransaction(club!.id, txId),
    onSuccess() {
      toast.success("Transaction deleted.");
      void qc.invalidateQueries({ queryKey: ["budget", club?.id] });
    },
    onError(e) { toast.error(getApiErrorMessage(e)); },
  });

  const allocMutation = useMutation({
    mutationFn: () => allocateBudget(club!.id, Math.round(Number(allocAmount) * 100), allocYear),
    onSuccess() {
      toast.success("Budget allocated.");
      setShowAllocModal(false);
      void qc.invalidateQueries({ queryKey: ["budget", club?.id] });
    },
    onError(e) { toast.error(getApiErrorMessage(e)); },
  });

  if (!club || isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!isOfficer) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center py-20">
        <PiggyBank size={48} className="text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">You need to be a club officer to view the budget.</p>
      </div>
    );
  }

  const spent = budget?.totalExpenses ?? 0;
  const income = budget?.totalIncome ?? 0;
  const allocated = budget?.totalAllocated ?? 0;
  const balance = budget?.balance ?? 0;
  const spentPct = allocated > 0 ? Math.min((spent / allocated) * 100, 100) : 0;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/clubs/${slug}/manage`} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft size={18} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Club Budget</h1>
          <p className="text-sm text-gray-500">{club.name} · FY {budget?.fiscalYear ?? "2026"}</p>
        </div>
        <div className="ml-auto flex gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowAllocModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors"
            >
              <PiggyBank size={14} /> Set Allocation
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#EBA814] text-white text-sm font-semibold rounded-xl hover:bg-[#D99810] transition-colors"
          >
            <Plus size={14} /> Add Transaction
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Allocated", value: formatCurrency(allocated), icon: PiggyBank, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Income",    value: formatCurrency(income),    icon: TrendingUp, color: "text-green-600",  bg: "bg-green-50" },
          { label: "Expenses",  value: formatCurrency(spent),     icon: TrendingDown, color: "text-red-600",  bg: "bg-red-50" },
          { label: "Balance",   value: formatCurrency(balance),   icon: DollarSign, color: balance >= 0 ? "text-[#EBA814]" : "text-red-600", bg: balance >= 0 ? "bg-amber-50" : "bg-red-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className={`w-8 h-8 ${bg} rounded-xl flex items-center justify-center mb-2`}>
              <Icon size={15} className={color} />
            </div>
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className={`text-base font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Allocated spend bar */}
      {allocated > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex justify-between text-xs text-gray-500 mb-2 font-medium">
            <span>Budget utilisation</span>
            <span>{spentPct.toFixed(1)}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${spentPct > 90 ? "bg-red-500" : spentPct > 70 ? "bg-amber-500" : "bg-[#EBA814]"}`}
              style={{ width: `${spentPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{formatCurrency(spent)} spent</span>
            <span>{formatCurrency(allocated - spent)} remaining</span>
          </div>
        </div>
      )}

      {/* Transaction list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
          <ReceiptText size={15} className="text-gray-500" />
          <h2 className="text-sm font-bold text-gray-700">Transactions</h2>
          <span className="ml-auto text-xs text-gray-400">{budget?.transactions.length ?? 0} total</span>
        </div>

        {!budget?.transactions.length ? (
          <div className="py-12 text-center">
            <ReceiptText size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No transactions yet. Add the first one.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {budget.transactions.map((tx: BudgetTransaction) => (
              <div key={tx.id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    tx.type === "INCOME" ? "bg-green-50" : "bg-red-50"
                  }`}>
                    {tx.type === "INCOME"
                      ? <TrendingUp size={14} className="text-green-600" />
                      : <TrendingDown size={14} className="text-red-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{tx.description}</p>
                    <p className="text-xs text-gray-400">
                      {tx.createdBy.name} · {new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <span className={`text-sm font-bold flex-shrink-0 ${tx.type === "INCOME" ? "text-green-600" : "text-red-600"}`}>
                    {tx.type === "INCOME" ? "+" : "-"}{formatCurrency(tx.amount)}
                  </span>
                  <div className="flex items-center gap-1">
                    {tx.receiptUrl && (
                      <button
                        onClick={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {expandedTx === tx.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                    <button
                      onClick={() => { if (confirm("Delete this transaction?")) deleteMutation.mutate(tx.id); }}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {expandedTx === tx.id && tx.receiptUrl && (
                  <div className="mt-3 ml-11">
                    <a href={tx.receiptUrl} target="_blank" rel="noopener noreferrer">
                      <img src={tx.receiptUrl} alt="Receipt" className="max-h-48 rounded-xl border border-gray-100 object-cover" />
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-bold text-gray-900">Add Transaction</h2>

            <div className="flex gap-2">
              {(["INCOME", "EXPENSE"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTxType(t)}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-colors ${
                    txType === t
                      ? t === "INCOME"
                        ? "bg-green-500 text-white"
                        : "bg-red-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {t === "INCOME" ? "➕ Income" : "➖ Expense"}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Description</label>
              <input
                value={txDesc}
                onChange={(e) => setTxDesc(e.target.value)}
                placeholder="e.g. Venue rental, Sponsorship received..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">$</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1.5">
                <Upload size={12} /> Receipt (optional)
              </label>
              <FileUpload
                type="poster"
                value={txReceipt}
                onChange={(url) => setTxReceipt(url)}
                label="Upload receipt image"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setTxDesc(""); setTxAmount(""); setTxReceipt(null); }}
                className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => addMutation.mutate()}
                disabled={addMutation.isPending || !txDesc.trim() || !txAmount}
                className="flex-1 py-3 bg-[#EBA814] hover:bg-[#D99810] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
              >
                {addMutation.isPending ? "Saving..." : "Add Transaction"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Allocate Budget Modal (admin only) */}
      {showAllocModal && isAdmin && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-bold text-gray-900">Set Budget Allocation</h2>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Fiscal Year</label>
              <input
                value={allocYear}
                onChange={(e) => setAllocYear(e.target.value)}
                placeholder="2026"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Total Allocated Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={allocAmount}
                  onChange={(e) => setAllocAmount(e.target.value)}
                  placeholder="500.00"
                  className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814]"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAllocModal(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => allocMutation.mutate()}
                disabled={allocMutation.isPending || !allocAmount}
                className="flex-1 py-3 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
              >
                {allocMutation.isPending ? "Saving..." : "Save Allocation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
