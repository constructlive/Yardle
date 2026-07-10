import type { PaidStatus, Payment } from "./types";

export function activePayments(payments: Payment[]) {
  return payments.filter((payment) => !payment.reversedAt);
}

export function paymentTotals(totalDuePence: number, payments: Payment[]) {
  const active = activePayments(payments);
  const amountPaidPence = active.reduce((sum, payment) => sum + payment.amountPence, 0);
  const remainingBalancePence = Math.max(0, totalDuePence - amountPaidPence);
  const paidStatus: PaidStatus = amountPaidPence >= totalDuePence ? "paid" : amountPaidPence > 0 ? "part_paid" : "unpaid";
  const paymentDate = active.length ? active.map((payment) => payment.paymentDate).sort().at(-1) : undefined;
  return { amountPaidPence, remainingBalancePence, paidStatus, paymentDate };
}

export function reversePaymentPreview(totalDuePence: number, payments: Payment[], paymentId: string) {
  const target = activePayments(payments).find((payment) => payment.id === paymentId);
  if (!target) return undefined;
  const remaining = activePayments(payments).filter((payment) => payment.id !== paymentId);
  return { target, ...paymentTotals(totalDuePence, remaining) };
}