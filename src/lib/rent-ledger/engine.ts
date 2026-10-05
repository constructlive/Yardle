import { RentError } from "./errors";
import type { Allocation, Category, Charge, LedgerAccount, PaymentInput, Receipt, Schedule } from "./types";

export function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
export function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value; }
export function date(value: string) { if (!validDate(value)) throw new RentError("Enter a valid calendar date."); return new Date(value + "T12:00:00Z"); }
export function addDays(value: string, days: number) { const d = date(value); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
export function daysBetween(from: string, to: string) { return Math.round((date(to).getTime() - date(from).getTime()) / 86400000); }
export function money(value: string) {
  if (!/^-?\d+(\.\d{1,2})?$/.test(value.trim())) throw new RentError("Enter an amount with up to two decimal places.");
  const n = Math.round(Number(value) * 100); if (!Number.isSafeInteger(n) || Math.abs(n) > 2147483647) throw new RentError("Amount is outside the supported range."); return n;
}
export function assertSchedule(s: Schedule) {
  date(s.startDate); if (s.endDate) { date(s.endDate); if (s.endDate < s.startDate) throw new RentError("End date precedes start date."); }
  if (!["weekly", "monthly", "manual"].includes(s.frequency) || !["advance", "arrears"].includes(s.timing) || !["daily", "full"].includes(s.partialRule)) throw new RentError("Invalid schedule rule.");
  if (!Number.isInteger(s.dueDay) || s.dueDay < (s.frequency === "weekly" ? 0 : 1) || s.dueDay > (s.frequency === "weekly" ? 6 : 31)) throw new RentError("Invalid due day (weekly: 0 Sunday–6 Saturday; monthly: 1–31).");
  if (!s.rates.length || !s.name.trim()) throw new RentError("A name and an initial rate are required.");
  const seen = new Set<string>();
  for (const r of s.rates) { date(r.effectiveDate); if (!Number.isSafeInteger(r.amountPence) || r.amountPence < 0 || seen.has(r.effectiveDate)) throw new RentError("Invalid or duplicate dated rate."); seen.add(r.effectiveDate); }
  if (!s.rates.some(r => r.effectiveDate <= s.startDate)) throw new RentError("An initial rate must cover the schedule start date.");
}
function monthAnchor(year: number, month: number, day: number) {
  const first = new Date(Date.UTC(year, month, 1, 12));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(day, last), 12)).toISOString().slice(0, 10);
}
function cycleStart(s: Schedule, value: string) {
  const d = date(value);
  if (s.frequency === "weekly") return addDays(value, -((d.getUTCDay() - s.dueDay + 7) % 7));
  const anchor = monthAnchor(d.getUTCFullYear(), d.getUTCMonth(), s.dueDay);
  return anchor <= value ? anchor : monthAnchor(d.getUTCFullYear(), d.getUTCMonth() - 1, s.dueDay);
}
function nextCycle(s: Schedule, value: string) {
  if (s.frequency === "weekly") return addDays(value, 7);
  const d = date(value); return monthAnchor(d.getUTCFullYear(), d.getUTCMonth() + 1, s.dueDay);
}

/** Projections never mutate the ledger. Period keys use the natural cycle, not the current rate. */
export function projectCharges(account: LedgerAccount, throughDate = today(), firstCoverageDate = account.approval?.firstCoverageDate): Charge[] {
  date(throughDate); if (!firstCoverageDate) return []; date(firstCoverageDate);
  const result: Charge[] = [];
  for (const s of account.schedules) {
    assertSchedule(s); if (!s.enabled || s.frequency === "manual") continue;
    const from = s.startDate > firstCoverageDate ? s.startDate : firstCoverageDate;
    let start = cycleStart(s, from); let iterations = 0;
    while (start <= throughDate && (!s.endDate || start <= s.endDate)) {
      if (++iterations > 10000) throw new RentError("Schedule is too long; review its start date.");
      const next = nextCycle(s, start); const naturalEnd = addDays(next, -1);
      const periodStart = start < from ? from : start;
      const periodEnd = s.endDate && s.endDate < naturalEnd ? s.endDate : naturalEnd;
      if (periodStart <= periodEnd) {
        const rates = [...s.rates].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
        const denominator = daysBetween(start, next);
        const calculation: NonNullable<Charge["calculation"]> = [];
        let cursor = periodStart;
        while (cursor <= periodEnd) {
          const rate = rates.filter(r => r.effectiveDate <= cursor).at(-1);
          if (!rate) throw new RentError(`Missing rate for ${s.name} on ${cursor}.`);
          const following = rates.find(r => r.effectiveDate > cursor);
          const end = following && following.effectiveDate <= periodEnd ? addDays(following.effectiveDate, -1) : periodEnd;
          calculation.push({ from: cursor, to: end, ratePence: rate.amountPence, days: daysBetween(cursor, end) + 1, denominator });
          cursor = addDays(end, 1);
        }
        // Rate changes always split on their exact date. Full-period billing only
        // changes the divisor for a clipped cycle; the rate segments remain dated.
        const divisor = s.partialRule === "full" ? daysBetween(periodStart, periodEnd) + 1 : denominator;
        if (s.partialRule === "full") for (const segment of calculation) segment.denominator = divisor;
        const amountPence = Math.round(calculation.reduce((sum, c) => sum + c.ratePence * c.days / divisor, 0));
        const dueDate = s.timing === "advance" ? periodStart : addDays(periodEnd, 1);
        result.push({ id: `schedule:${s.id}:${start}`, accountId: account.id, sourceId: s.id, category: s.kind, description: s.name, periodStart, periodEnd, dueDate, amountPence, coverageKnown: true, calculation });
      }
      start = next;
    }
  }
  return result;
}
export function chargesWithProjections(account: LedgerAccount, horizon = addDays(today(), 90), firstCoverageDate?: string) {
  const existing = new Set(account.charges.map(c => c.id));
  return [...account.charges, ...projectCharges(account, horizon, firstCoverageDate).filter(c => !existing.has(c.id))].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
}
export function allocatedTo(account: LedgerAccount, chargeId: string, asOf?: string) {
  return account.payments.filter(p => !p.reversedAt && (!asOf || p.receivedDate <= asOf)).reduce((sum, p) => sum + p.allocations.filter(a => a.chargeId === chargeId).reduce((n, a) => n + a.amountPence, 0), 0);
}
export function chargeRemaining(account: LedgerAccount, charge: Charge, asOf?: string) { return charge.cancelled ? 0 : Math.max(0, charge.amountPence - allocatedTo(account, charge.id, asOf)); }
export function balances(account: LedgerAccount, asOf = today(), charges = account.charges) {
  const active = charges.filter(c => !c.cancelled);
  const due = active.filter(c => c.dueDate <= asOf);
  // Adjustment metadata is audited separately; its debit charge or credit entry carries the money.
  const adjustment = 0;
  const payments = account.payments.filter(p => !p.reversedAt && p.receivedDate <= asOf);
  const paid = payments.reduce((sum, p) => sum + p.amountPence, 0);
  const net = due.reduce((sum, c) => sum + c.amountPence, 0) + adjustment - paid;
  const unallocated = payments.reduce((sum, p) => sum + p.amountPence - p.allocations.reduce((n, a) => n + a.amountPence, 0), 0);
  const overdue = active.filter(c => c.dueDate < asOf).reduce((sum, c) => sum + chargeRemaining(account, c, asOf), 0) + Math.max(0, adjustment);
  const availableCredit = unallocated + Math.max(0, -adjustment);
  // Unallocated credit is deliberately not assigned to rent or services or counted as coverage.
  const categories = (category: Category) => due.filter(c => c.category === category).reduce((sum, c) => sum + chargeRemaining(account, c, asOf), 0);
  return { net, outstanding: Math.max(0, net), overdue: Math.max(0, overdue), credit: Math.max(0, availableCredit), upcoming: active.filter(c => c.dueDate > asOf).reduce((sum, c) => sum + chargeRemaining(account, c, asOf), 0), rent: categories("rent"), services: categories("service"), opening: categories("opening"), paid };
}
export function suggestAllocation(account: LedgerAccount, amountPence: number, charges: Charge[], selection?: { from: string; to: string }) {
  let remaining = amountPence;
  const eligible = charges.filter(c => !c.cancelled && (!selection || (c.category === "rent" && c.periodStart && c.periodEnd && c.periodStart <= selection.to && c.periodEnd >= selection.from))).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
  const result: Allocation[] = [];
  for (const c of eligible) { const amount = Math.min(remaining, chargeRemaining(account, c)); if (amount > 0) result.push({ chargeId: c.id, amountPence: amount }); remaining -= amount; }
  return result;
}
export function validatePayment(account: LedgerAccount, input: PaymentInput, charges: Charge[], asOf = today()) {
  if (input.accountId !== account.id || !input.requestId || input.requestId.length > 100) throw new RentError("Invalid payment request.");
  if (!Number.isSafeInteger(input.amountPence) || input.amountPence <= 0 || input.amountPence > 2147483647) throw new RentError("Payment must be a positive amount.");
  date(input.receivedDate); if (input.receivedDate > asOf) throw new RentError("A payment cannot be received in the future.");
  if (!["cash", "bank_transfer", "card", "other"].includes(input.method)) throw new RentError("Invalid payment method.");
  const seen = new Set<string>(); let allocated = 0;
  for (const a of input.allocations) {
    const c = charges.find(c => c.id === a.chargeId);
    if (!c || c.accountId !== account.id || c.cancelled || seen.has(a.chargeId) || !Number.isSafeInteger(a.amountPence) || a.amountPence <= 0 || a.amountPence > chargeRemaining(account, c)) throw new RentError("An allocation exceeds its unpaid charge or is invalid. Refresh the preview.");
    seen.add(a.chargeId); allocated += a.amountPence;
  }
  if (allocated > input.amountPence) throw new RentError("Allocations exceed the payment amount.");
}
/** Coverage is contiguous and requires every rent source active on a day to be fully allocated. */
export function rentCoverage(account: LedgerAccount) {
  if (!account.approval) return { through: undefined as string | undefined, fullyCovered: [] as Charge[] };
  const rent = account.charges.filter(c => c.category === "rent" && c.coverageKnown && !c.cancelled && c.periodStart && c.periodEnd);
  const settled = rent.filter(c => chargeRemaining(account, c) === 0);
  const sourcesOn = (day: string) => account.schedules.filter(s => s.kind === "rent" && (s.enabled || rent.some(c => c.sourceId === s.id && c.periodStart! <= day && c.periodEnd! >= day)) && s.startDate <= day && (!s.endDate || s.endDate >= day));
  const dayCovered = (day: string) => {
    const sources = sourcesOn(day);
    return sources.length > 0 && sources.every(s => settled.some(c => c.sourceId === s.id && c.periodStart! <= day && c.periodEnd! >= day)) && !rent.some(c => c.periodStart! <= day && c.periodEnd! >= day && chargeRemaining(account, c) > 0);
  };
  const fullyCovered = settled.filter(c => {
    if (c.baseChargeId) return false;
    for (let day = c.periodStart!; day <= c.periodEnd!; day = addDays(day, 1)) if (!dayCovered(day)) return false;
    return true;
  });
  const historicalThrough = account.reconciliation?.paidThrough && account.reconciliation.paidThrough < account.approval.firstCoverageDate ? account.reconciliation.paidThrough : undefined;
  let cursor = historicalThrough ? addDays(historicalThrough, 1) : account.approval.firstCoverageDate; let through: string | undefined = historicalThrough;
  const last = rent.map(c => c.periodEnd!).sort().at(-1);
  let steps = 0;
  while (last && cursor <= last && ++steps < 40000) {
    const sources = sourcesOn(cursor);
    if (!sources.length) { if (cursor < account.approval.firstCoverageDate) break; cursor = addDays(cursor, 1); continue; }
    if (!dayCovered(cursor)) break;
    through = cursor; cursor = addDays(cursor, 1);
  }
  return { through, fullyCovered };
}
export function previewPayment(account: LedgerAccount, input: PaymentInput, charges: Charge[]) {
  validatePayment(account, input, charges);
  const next = structuredClone(account);
  next.charges = charges.filter(c => account.charges.some(old => old.id === c.id) || input.allocations.some(a => a.chargeId === c.id));
  const receipt: Receipt = { ...input, id: input.requestId, recordedBy: "preview", createdAt: new Date().toISOString() };
  next.payments.push(receipt);
  return { account: next, balances: balances(next), coverage: rentCoverage(next) };
}
export function paymentMessage(account: LedgerAccount, receipt: Receipt) {
  const fmt = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n / 100);
  const b = balances(account); const coverage = rentCoverage(account);
  const newlyCovered = coveredByAllocation(account, receipt.allocations);
  const periods = newlyCovered.map(c => `${c.periodStart} to ${c.periodEnd}`).filter((p, i, all) => all.indexOf(p) === i);
  return `${account.name}: received ${fmt(receipt.amountPence)} on ${receipt.receivedDate}.${periods.length ? ` Rent period(s) fully covered: ${periods.join(", ")}.` : " No additional full rent period covered."}${coverage.through ? ` Rent paid through ${coverage.through}.` : ""} Current balance ${fmt(b.outstanding)}; unallocated credit ${fmt(b.credit)}.${b.overdue ? ` Unpaid overdue charges ${fmt(b.overdue)} (credit remains unallocated).` : ""}`;
}
export function coveredByAllocation(account: LedgerAccount, allocations: Allocation[]) {
  return rentCoverage(account).fullyCovered.filter(c => allocations.some(a => a.chargeId === c.id || account.charges.find(x => x.id === a.chargeId)?.baseChargeId === c.id));
}
