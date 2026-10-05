import { addDays, date, daysBetween, money, today, validDate } from "./engine";
import { RentFieldError } from "./errors";
import type { Schedule } from "./types";

export type ReconcileInput = {
  accountId: string; version: number; requestId: string; first: string; calculationFrom: string;
  lastPaymentDate: string; lastPaymentAmount: string; paidThrough: string; coverageFrom: string;
  opening: string; reason: string; deductKnownPayments?: boolean; confirmed?: boolean;
  setupMode?: "calculator" | "manual"; firstUnpaid?: string; previousRent?: string; newRent?: string;
  effectiveDate?: string; frequency?: "weekly" | "monthly"; calculationDate?: string;
};
const fail = (field: string, text: string): never => { throw new RentFieldError(field, text); };
function checkDate(value: string | undefined, field: string, label: string, required = false) {
  if (!value && !required) return;
  if (!value || !validDate(value)) fail(field, `${label}: enter a valid calendar date.`);
}
function amount(value: string | undefined, field: string, label: string, required = false) {
  if (!value?.trim() && !required) return undefined;
  try { return money(value || ""); } catch { return fail(field, `${label}: enter an amount in pounds with up to two decimal places.`); }
}
export function currentRentStart(asOf: string, frequency: "weekly" | "monthly") {
  return frequency === "monthly" ? asOf.slice(0,7) + "-01" : addDays(asOf, -((date(asOf).getUTCDay()+6)%7));
}
export function nextRentStart(start: string, frequency: "weekly" | "monthly") {
  if (frequency === "weekly") return addDays(start,7);
  const d = date(start); d.setUTCMonth(d.getUTCMonth()+1,1); return d.toISOString().slice(0,10);
}
/** Shared by client and server. Optional blanks never reach strict date arithmetic. */
export function normaliseReconciliation(raw: ReconcileInput, draft: boolean): ReconcileInput {
  const i = { ...raw };
  for (const key of ["first","calculationFrom","lastPaymentDate","lastPaymentAmount","paidThrough","coverageFrom","opening","reason","firstUnpaid","previousRent","newRent","effectiveDate","calculationDate"] as const) i[key] = (i[key] || "").trim();
  checkDate(i.lastPaymentDate,"lastPaymentDate","Last payment date");
  if (i.lastPaymentDate > today()) fail("lastPaymentDate","Last payment date cannot be in the future.");
  if ((amount(i.lastPaymentAmount,"lastPaymentAmount","Last payment amount") ?? 0) < 0) fail("lastPaymentAmount","Last payment amount cannot be negative.");
  amount(i.opening,"opening","Opening arrears / credit",i.setupMode === "manual");
  checkDate(i.calculationDate,"calculationDate","Calculation date");
  if (i.setupMode) {
    if (!["calculator","manual"].includes(i.setupMode)) fail("setupMode","Choose calculator or manual balance.");
    if (draft) {
      if (i.frequency !== "weekly" && i.frequency !== "monthly") fail("frequency","Choose weekly or calendar monthly rent.");
      i.calculationDate ||= today();
      checkDate(i.calculationDate,"calculationDate","Calculation date",true);
      if (i.calculationDate > today()) fail("calculationDate","Calculation date cannot be in the future.");
      i.first = currentRentStart(i.calculationDate,i.frequency!);
      checkDate(i.effectiveDate,"effectiveDate","New rate effective date",true);
      if ((amount(i.newRent,"newRent","New rent",true) ?? 0) <= 0) fail("newRent","New rent must be greater than £0.");
      if (i.setupMode === "calculator") {
        checkDate(i.firstUnpaid,"firstUnpaid","First unpaid rent date",true);
        if (i.frequency === "weekly" && date(i.firstUnpaid!).getUTCDay() !== 1) fail("firstUnpaid","First unpaid rent date: select a Monday explicitly. The date has not been moved.");
        if (i.frequency === "monthly" && date(i.firstUnpaid!).getUTCDate() !== 1) fail("firstUnpaid","First unpaid rent date: select the 1st of the month.");
        if (i.firstUnpaid! > i.first) fail("firstUnpaid","First unpaid rent date is after the current period. Use a manual credit balance for advance payments.");
        if (daysBetween(i.firstUnpaid!,i.calculationDate)>3660) fail("firstUnpaid","First unpaid rent date: limit the calculation to ten years.");
        i.calculationFrom = i.firstUnpaid!;
        i.paidThrough = addDays(i.firstUnpaid!,-1);
      } else {
        i.calculationFrom = "";
        amount(i.opening,"opening","Opening arrears / credit",true);
      }
      const start = i.setupMode === "calculator" ? i.firstUnpaid! : i.first;
      const previous = amount(i.previousRent,"previousRent","Previous rent",start < i.effectiveDate!);
      if (previous !== undefined && previous < 0) fail("previousRent","Previous rent cannot be negative.");
    } else if (i.setupMode === "calculator") fail("setupMode","This account is already active. Its historical setup is saved; use a balance correction instead.");
  }
  // A live balance correction needs no old coverage-start date.
  if (!draft && !i.first) i.first = today();
  checkDate(i.first,"first","First date of new rent coverage",draft);
  if (draft && i.first > today()) fail("first","First date of new rent coverage cannot be in the future.");
  checkDate(i.calculationFrom,"calculationFrom","Calculate historical arrears from");
  checkDate(i.paidThrough,"paidThrough","Rent paid through");
  checkDate(i.coverageFrom,"coverageFrom","Earliest confirmed paid date");
  if (i.coverageFrom && !i.paidThrough) fail("paidThrough","Rent paid through: enter the end of confirmed paid coverage, or leave both coverage dates blank.");
  if (i.coverageFrom && i.coverageFrom > i.paidThrough) fail("coverageFrom","Earliest confirmed paid date must be on or before rent paid through.");
  if (draft && i.paidThrough && i.paidThrough >= i.first) fail("paidThrough","Rent paid through must be before new coverage starts. First unpaid is the following day.");
  if (!draft && i.paidThrough > today()) fail("paidThrough","Rent paid through cannot be in the future here. Allocate advance payments using Record payment.");
  return i;
}
export function reconciliationSchedule(i: ReconcileInput): Schedule {
  const start = i.setupMode === "calculator" ? i.firstUnpaid! : i.first;
  const rates = start < i.effectiveDate! ? [{ effectiveDate: start, amountPence: money(i.previousRent!) }, { effectiveDate: i.effectiveDate!, amountPence: money(i.newRent!) }] : [{ effectiveDate: i.effectiveDate!, amountPence: money(i.newRent!) }];
  return { id: `reconciliation-rent:${i.accountId}`, name: "Rent", kind: "rent", frequency: i.frequency!, dueDay: 1, timing: "advance", partialRule: "daily", startDate: start, enabled: true, rates };
}
