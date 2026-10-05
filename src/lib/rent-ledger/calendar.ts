import { chargeRemaining, chargesWithProjections, today } from "./engine";
import type { LedgerAccount } from "./types";

export function calendarDay(account: LedgerAccount, day: string, asOf = today()) {
  const charges = chargesWithProjections(account, day > asOf ? day : asOf).filter(c => c.category === "rent" && !c.cancelled && c.coverageKnown && c.periodStart! <= day && c.periodEnd! >= day);
  const total = charges.reduce((n,c) => n + c.amountPence, 0);
  const unpaid = charges.reduce((n,c) => n + chargeRemaining(account,c,asOf), 0);
  const paid = total - unpaid;
  const historical = account.reconciliation?.coverageFrom && day >= account.reconciliation.coverageFrom && day <= (account.reconciliation.paidThrough || "") && day < (account.approval?.firstCoverageDate || "");
  const expected = account.schedules.filter(s => s.enabled && s.kind === "rent" && s.startDate <= day && (!s.endDate || s.endDate >= day));
  const complete = charges.length > 0 && expected.every(s => charges.some(c => c.sourceId === s.id));
  const status: "paid" | "partial" | "overdue" | "unpaid" | "unknown" = historical && !charges.length ? "paid" : complete && unpaid === 0 ? "paid" : paid > 0 ? "partial" : charges.some(c => c.dueDate < asOf && chargeRemaining(account,c,asOf) > 0) ? "overdue" : charges.length ? "unpaid" : "unknown";
  const label = status === "paid" ? historical && !charges.length ? "Paid · reconciled" : "Fully paid" : status === "partial" ? "Partially paid" : status === "overdue" ? "Overdue unpaid" : status === "unpaid" ? charges.every(c => c.dueDate > asOf) ? "Future unpaid" : "Due today" : "Coverage unknown";
  return { status, label, total, paid, unpaid, charges, percent: total ? Math.round(paid / total * 100) : 0 };
}
