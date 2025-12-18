// src/utils/payable.ts
import type { Installment, InstallmentStatus } from "@/types/Payable";

/* =========================================================
 * BUILD INSTALLMENT SCHEDULE
 * ========================================================= */
export function buildInstallmentSchedule(
  total: number,
  issueDate: string,
  termsDays: number,
  installments: number
): Installment[] {
  const safeTotal = round2(Number(total || 0));
  const safeInstallments = Math.max(1, Math.trunc(Number(installments || 1)));
  const safeTermsDays = Math.max(0, Math.trunc(Number(termsDays || 0)));

  if (installments <= 1) {
    return [
      {
        index: 1,
        dueDate: addDays(issueDate, termsDays),
        amount: safeTotal,
        paid: 0,
        balance: safeTotal,
        status: "pending",
      },
    ];
  }

  const perInstallment = round2(safeTotal / installments);
  const remainder = round2(safeTotal - perInstallment * installments);

  const schedule: Installment[] = [];

  for (let i = 1; i <= safeInstallments; i++) {
    const baseDays = Math.round((safeTermsDays / safeInstallments) * i);
    const amount =
      i === safeInstallments ? perInstallment + remainder : perInstallment;

    schedule.push({
      index: i,
      dueDate: addDays(issueDate, baseDays),
      amount: round2(amount),
      paid: 0,
      balance: round2(amount),
      status: "pending",
    });
  }

  return schedule;
}

/* =========================================================
 * APPLY PAYMENT TO INSTALLMENTS
 * ========================================================= */
export function applyPaymentToInstallments(
  schedule: Installment[],
  amount: number
): {
  updatedSchedule: Installment[]; paidDelta: number } {
  let remaining = round2(Number(amount || 0));
  let paidDelta = 0;

  const updatedSchedule: Installment[] = schedule.map((inst) => {
    if (remaining <= 0 || inst.balance <= 0) return inst;

    const pay = round2(Math.min(inst.balance, remaining));

    const paid = round2(inst.paid + pay);
    const balance = round2(inst.amount - paid);

    remaining = round2(remaining - pay);
    paidDelta = round2(paidDelta + pay);

    const status: InstallmentStatus = balance <= 0 ? "paid" : "partial";

    return {
      ...inst,
      paid,
      balance,
      status,
    };
  });

  return { updatedSchedule, paidDelta };
}


/* ==============================
   Helpers
================================ */
function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}