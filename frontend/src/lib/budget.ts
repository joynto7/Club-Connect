import { api } from "./axios";

export type BudgetTransaction = {
  id: string;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  receiptUrl?: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
};

export type ClubBudget = {
  id: string;
  clubId: string;
  totalAllocated: number;
  fiscalYear: string;
  updatedAt: string;
  transactions: BudgetTransaction[];
  totalIncome: number;
  totalExpenses: number;
  balance: number;
};

export async function getClubBudget(clubId: string) {
  const r = await api.get<ClubBudget>(`/clubs/${clubId}/budget`);
  return r.data;
}

export async function addBudgetTransaction(
  clubId: string,
  data: { description: string; amount: number; type: "INCOME" | "EXPENSE"; receiptUrl?: string }
) {
  const r = await api.post<BudgetTransaction>(`/clubs/${clubId}/budget/transactions`, data);
  return r.data;
}

export async function deleteBudgetTransaction(clubId: string, txId: string) {
  await api.delete(`/clubs/${clubId}/budget/transactions/${txId}`);
}

export async function allocateBudget(clubId: string, totalAllocated: number, fiscalYear?: string) {
  const r = await api.put<ClubBudget>(`/clubs/${clubId}/budget/allocate`, { totalAllocated, fiscalYear });
  return r.data;
}

export function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
