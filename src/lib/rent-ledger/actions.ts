"use server";
import { RentError } from "./errors";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "../session";
import { getSmsProvider } from "../sms";
import { getActiveSmsProviderName } from "../sms-logging";
import { addDays, assertSchedule, balances, chargesWithProjections, coveredByAllocation, date, money, paymentMessage, previewPayment, projectCharges, today, validatePayment } from "./engine";
import { archiveRentAccount, audit, catchUpAccount, createAccount, getLedgerAccounts, mutateAccount, readAccounts, setUnitMembership, setUpUnitRentAccount, groupExistingRentAccount } from "./store";
import type { LedgerAccount, PaymentInput, Receipt, Schedule } from "./types";

function refresh() { revalidatePath("/admin/rent", "layout"); }
const value = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
function version(f: FormData) { const n = Number(value(f, "version")); if (!Number.isInteger(n)) throw new RentError("Invalid account version."); return n; }
export async function saveAccountDetails(f: FormData) {
  const user = await requireAdminSession(); const id = value(f, "accountId");
  const details = { name: value(f, "name"), contactName: value(f, "contactName"), mobile: value(f, "mobile"), email: value(f, "email") };
  if (!details.name) throw new RentError("Account name is required.");
  if (!id) {
    const a: LedgerAccount = { id: randomUUID(), ...details, unitIds: [], schedules: [], charges: [], payments: [], adjustments: [], audit: [], version: 0, state: "review", portalEnabled: false, migration: { importedAt: new Date().toISOString(), originalOpeningPence: 0, suggestedOpeningPence: 0, legacyThroughDate: "", warnings: [], snapshot: {} } };
    audit(a, user.userId, "account_created", details); await createAccount(a);
  } else await mutateAccount(id, a => { const before = { name: a.name, contactName: a.contactName, mobile: a.mobile, email: a.email }; Object.assign(a, details); audit(a, user.userId, "contact_changed", { before, after: details }); }, version(f));
  refresh();
}
export async function saveAccountUnits(f: FormData) {
  const user = await requireAdminSession(); const reason = value(f, "reason"); if (!reason) throw new RentError("Explain the unit membership change.");
  const unitIds = f.getAll("unitIds").map(String); const { getAppData } = await import("../data"); const data = await getAppData();
  if (unitIds.some(id => !data.units.some(u => u.id === id))) throw new RentError("Unknown unit.");
  await setUnitMembership(value(f, "accountId"), unitIds, version(f), user.userId, reason); refresh();
}
export async function saveSchedule(f: FormData) {
  const user = await requireAdminSession();
  await mutateAccount(value(f, "accountId"), a => {
    const id = value(f, "sourceId") || randomUUID(); const previous = a.schedules.find(s => s.id === id);
    const startDate = value(f, "startDate");
    const s: Schedule = { id, name: value(f, "name"), kind: value(f, "kind") === "service" ? "service" : "rent", frequency: value(f, "frequency") as Schedule["frequency"], startDate, endDate: value(f, "endDate") || undefined, dueDay: Number(value(f, "dueDay")), timing: value(f, "timing") as Schedule["timing"], partialRule: value(f, "partialRule") as Schedule["partialRule"], enabled: f.get("enabled") === "on", rates: previous?.rates ?? [{ effectiveDate: startDate, amountPence: money(value(f, "amount")) }] };
    if (a.state === "review" && previous && !a.charges.some(c => c.sourceId === id)) s.rates = [{ effectiveDate: startDate, amountPence: money(value(f, "amount")) }, ...previous.rates.slice(1).filter(r => r.effectiveDate > startDate)];
    assertSchedule(s);
    if (previous && a.state !== "review") {
      if (["kind", "frequency", "startDate", "dueDay", "timing", "partialRule", "enabled"].some(k => previous[k as keyof Schedule] !== s[k as keyof Schedule])) throw new RentError("An active schedule's rules are historical. End it and add a new schedule instead.");
      const lastEnd = a.charges.filter(c => c.sourceId === id && !c.cancelled).map(c => c.periodEnd || c.dueDate).sort().at(-1);
      if (s.endDate && ((lastEnd && s.endDate < lastEnd) || s.endDate < today())) throw new RentError("The end date would change an existing period. Use an audited adjustment to correct billed rent.");
    }
    if (!previous && a.state !== "review" && startDate < today()) throw new RentError("New schedules on live accounts must start today or later.");
    a.schedules = [...a.schedules.filter(s => s.id !== id), s]; audit(a, user.userId, "schedule_saved", { before: previous, after: s }); catchUpAccount(a);
  }, version(f)); refresh();
}
export async function addRate(f: FormData) {
  const user = await requireAdminSession();
  await mutateAccount(value(f, "accountId"), a => {
    const s = a.schedules.find(s => s.id === value(f, "sourceId")); if (!s) throw new RentError("Schedule not found.");
    const effectiveDate = value(f, "effectiveDate"); date(effectiveDate); const amountPence = money(value(f, "amount"));
    if (amountPence < 0 || s.rates.some(r => r.effectiveDate === effectiveDate)) throw new RentError("Enter a non-negative rate on a new effective date.");
    if (a.state !== "review" && effectiveDate < today()) throw new RentError("Historical rates are locked. Correct an error using an audited adjustment.");
    s.rates.push({ effectiveDate, amountPence }); assertSchedule(s);
    const amendments: unknown[] = [];
    if (a.approval) {
      const horizon = a.charges.filter(c => c.sourceId === s.id).map(c => c.periodEnd || c.dueDate).sort().at(-1) || today();
      for (const revised of projectCharges(a, horizon).filter(c => c.sourceId === s.id && c.periodEnd! >= effectiveDate)) {
        const original = a.charges.find(c => c.id === revised.id && !c.cancelled); if (!original) continue;
        const booked = a.charges.filter(c => !c.cancelled && (c.id === original.id || c.baseChargeId === original.id)).reduce((n,c) => n + c.amountPence, 0) - a.payments.filter(p => !p.reversedAt && p.rateChargeId === original.id).reduce((n,p) => n + p.amountPence, 0);
        const delta = revised.amountPence - booked; if (!delta) continue;
        const id = randomUUID(); const periodStart = effectiveDate > revised.periodStart! ? effectiveDate : revised.periodStart!;
        if (delta > 0) a.charges.push({ ...revised, id: `rate:${id}`, baseChargeId: original.id, periodStart, dueDate: original.dueDate > effectiveDate ? original.dueDate : effectiveDate, amountPence: delta, description: `${s.name}: rate increase from ${effectiveDate}` });
        else a.payments.push({ id: `rate:${id}`, requestId: `rate:${id}`, accountId: a.id, amountPence: -delta, receivedDate: effectiveDate > today() ? effectiveDate : today(), method: "other", reference: `${s.name}: rate credit from ${effectiveDate}`, allocations: [], recordedBy: user.userId, createdAt: new Date().toISOString(), legacyId: "rate-credit", rateChargeId: original.id });
        amendments.push({ originalChargeId: original.id, revisedCalculation: revised.calculation, previousPostedPence: booked, newTotalPence: revised.amountPence, deltaPence: delta });
      }
    }
    audit(a, user.userId, "rate_added", { sourceId: s.id, effectiveDate, amountPence, amendments }); catchUpAccount(a);
  }, version(f)); refresh();
}
function cutover(a: LedgerAccount, opening: number, first: string, actor: string, note: string) {
  if (a.state !== "review" || a.approval) throw new RentError("This account has already been signed off.");
  date(first); if (!note.trim()) throw new RentError("A reconciliation note is required.");
  if (!a.schedules.some(s => s.enabled && s.rates.some(r => r.amountPence > 0))) throw new RentError("Enter and enable the agreed rent or service rate before sign-off.");
  for (const s of a.schedules) assertSchedule(s);
  a.approval = { actor, at: new Date().toISOString(), firstCoverageDate: first, confirmedOpeningPence: opening, note };
  const before = addDays(first, -1);
  if (opening > 0) a.charges.push({ id: `opening:${a.id}`, accountId: a.id, sourceId: "opening", category: "opening", description: `Confirmed rent brought forward through ${before}`, dueDate: before, amountPence: opening, coverageKnown: false });
  if (opening < 0) a.payments.push({ id: `opening-credit:${a.id}`, requestId: `opening-credit:${a.id}`, accountId: a.id, amountPence: -opening, receivedDate: before, method: "other", reference: "Confirmed brought-forward credit", allocations: [], recordedBy: actor, createdAt: new Date().toISOString(), legacyId: "opening-credit" });
  a.state = "active"; audit(a, actor, "reconciliation_approved", { ...a.approval, archivedFiguresExcluded: true }); catchUpAccount(a);
}
export async function previewReconciliation(input: { accountId: string; version: number; opening: string; first: string; note: string }) {
  await requireAdminSession(); const a = (await readAccounts()).find(a => a.id === input.accountId);
  if (!a || a.version !== input.version) throw new RentError("Account changed; refresh before reviewing.");
  cutover(a, money(input.opening), input.first, "preview", input.note);
  return { balances: balances(a), charges: chargesWithProjections(a), version: input.version };
}
export async function approveReconciliation(input: { accountId: string; version: number; opening: string; first: string; note: string; confirmed: boolean }) {
  const user = await requireAdminSession(); if (!input.confirmed) throw new RentError("Administrator sign-off is required.");
  await mutateAccount(input.accountId, a => cutover(a, money(input.opening), input.first, user.userId, input.note), input.version); refresh();
}
export async function previewReceipt(input: PaymentInput) {
  await requireAdminSession(); const a = (await getLedgerAccounts()).find(a => a.id === input.accountId);
  if (!a || a.state === "review") throw new RentError("Sign off the account before recording live payments.");
  if (a.version !== input.version) throw new RentError("Account changed; refresh and preview again.");
  const result = previewPayment(a, input, chargesWithProjections(a));
  return { balances: result.balances, paidThrough: result.coverage.through, covered: coveredByAllocation(result.account, input.allocations), message: paymentMessage(result.account, result.account.payments.at(-1)!) };
}
export async function recordReceipt(input: PaymentInput) {
  const user = await requireAdminSession();
  const saved = await mutateAccount(input.accountId, a => {
    const existing = a.payments.find(p => p.requestId === input.requestId);
    if (existing) {
      if (existing.amountPence !== input.amountPence || existing.receivedDate !== input.receivedDate || existing.method !== input.method || existing.reference !== input.reference || JSON.stringify(existing.allocations) !== JSON.stringify(input.allocations)) throw new RentError("This retry key was already used for a different payment. Reload to record a new payment.");
      return existing;
    }
    if (a.state === "review" || a.version !== input.version) throw new RentError("Account changed or needs sign-off. Refresh and preview again.");
    const charges = chargesWithProjections(a); validatePayment(a, input, charges);
    const ids = new Set(a.charges.map(c => c.id)); a.charges.push(...charges.filter(c => !ids.has(c.id) && input.allocations.some(x => x.chargeId === c.id)));
    const p: Receipt = { ...input, id: randomUUID(), recordedBy: user.userId, createdAt: new Date().toISOString() };
    a.payments.push(p); p.confirmation = { mobile: a.mobile, message: paymentMessage(a, p), state: "prepared" }; audit(a, user.userId, "payment_received", p); return p;
  }); refresh(); return saved;
}
export async function reverseReceipt(f: FormData) {
  const user = await requireAdminSession(); const reason = value(f, "reason"); if (!reason) throw new RentError("A reversal reason is required.");
  await mutateAccount(value(f, "accountId"), a => {
    const p = a.payments.find(p => p.id === value(f, "paymentId")); if (!p || p.reversedAt) throw new RentError("Payment is missing or already reversed.");
    if (p.legacyId) throw new RentError("Correct opening or adjustment credit with an audited counter-adjustment.");
    if (p.confirmation?.state === "sending") throw new RentError("Wait for the pending SMS attempt before reversing this receipt.");
    p.reversedAt = new Date().toISOString(); p.reversedBy = user.userId; p.reversalReason = reason; audit(a, user.userId, "payment_reversed", { paymentId: p.id, reason });
  }, version(f)); refresh();
}
export async function sendReceiptConfirmation(accountId: string, paymentId: string) {
  const user = await requireAdminSession();
  const payload = await mutateAccount(accountId, a => {
    const p = a.payments.find(p => p.id === paymentId); const c = p?.confirmation;
    if (!p || p.reversedAt || !c) throw new RentError("Receipt is unavailable.");
    if (!["prepared", "failed"].includes(c.state)) throw new RentError("This message was submitted already. Check provider status before any further attempt.");
    if (!c.mobile) throw new RentError("No account mobile number was recorded when this receipt was saved.");
    c.state = "sending"; c.updatedAt = new Date().toISOString(); audit(a, user.userId, "sms_submission_started", { paymentId, mobile: c.mobile, message: c.message });
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/$/, "");
    return { mobile: c.mobile, message: c.message, ...(appUrl.startsWith("https://") ? { statusCallback: `${appUrl}/api/rent/sms-status?accountId=${encodeURIComponent(a.id)}&paymentId=${encodeURIComponent(p.id)}` } : {}) };
  });
  // Sending happens outside the payment transaction. Unknown results are never retried automatically.
  let result: { state: "sent" | "simulated" | "failed" | "unknown"; providerReference?: string; error?: string };
  try { const provider = getSmsProvider(await getActiveSmsProviderName()); const response = await provider.send(payload); result = { state: response.status === "failed" ? "failed" : response.status === "simulated" ? "simulated" : "sent", providerReference: response.providerReference, error: response.failureReason }; }
  catch { result = { state: "unknown", error: "Provider outcome unknown. Check the provider console before retrying." }; }
  await mutateAccount(accountId, a => { const p = a.payments.find(p => p.id === paymentId)!; Object.assign(p.confirmation!, result, { updatedAt: new Date().toISOString() }); audit(a, user.userId, "sms_submission_result", { paymentId, ...result }); }); refresh(); return result;
}
export async function addAdjustment(f: FormData) {
  const user = await requireAdminSession(); const amountPence = money(value(f, "amount")); const reason = value(f, "reason"); const on = value(f, "date"); date(on);
  if (!reason || !amountPence || on > today()) throw new RentError("Enter a reason, non-zero amount and date no later than today.");
  await mutateAccount(value(f, "accountId"), a => {
    if (a.state === "review") throw new RentError("Sign off the opening position first.");
    const id = randomUUID(); const category = value(f, "category") === "service" ? "service" : "rent";
    a.adjustments.push({ id, accountId: a.id, category, amountPence, date: on, reason, actor: user.userId });
    // Debit/credit adjustments are represented as allocatable ledger items, not a hidden balance offset.
    if (amountPence > 0) a.charges.push({ id: `adjustment:${id}`, accountId: a.id, sourceId: "adjustment", category, description: `Adjustment: ${reason}`, dueDate: on, amountPence, coverageKnown: false });
    else a.payments.push({ id: `adjustment:${id}`, requestId: `adjustment:${id}`, accountId: a.id, amountPence: -amountPence, receivedDate: on, method: "other", reference: `Credit adjustment: ${reason}`, allocations: [], recordedBy: user.userId, createdAt: new Date().toISOString(), legacyId: "adjustment-credit" });
    audit(a, user.userId, "adjustment_recorded", a.adjustments.at(-1));
  }, version(f)); refresh();
}
export async function setAccountState(f: FormData) {
  const user = await requireAdminSession(); await mutateAccount(value(f, "accountId"), a => {
    if (!a.approval) throw new RentError("Reconciliation sign-off is required.");
    a.state = a.state === "active" ? "paused" : "active"; audit(a, user.userId, "state_changed", a.state); catchUpAccount(a);
  }, version(f)); refresh();
}
export async function addManualCharge(f: FormData) {
  const user = await requireAdminSession();
  await mutateAccount(value(f, "accountId"), a => {
    if (!a.approval) throw new RentError("Sign off the opening position first.");
    const s = a.schedules.find(s => s.id === value(f, "sourceId") && s.frequency === "manual" && s.enabled); if (!s) throw new RentError("Select an enabled manual schedule.");
    const periodStart = value(f, "periodStart"), periodEnd = value(f, "periodEnd"), dueDate = value(f, "dueDate"); date(periodStart); date(periodEnd); date(dueDate);
    const amountPence = money(value(f, "amount"));
    if (amountPence <= 0 || periodEnd < periodStart || periodStart < a.approval.firstCoverageDate || periodStart < s.startDate || (s.endDate && periodEnd > s.endDate)) throw new RentError("Check the positive charge amount and its coverage dates.");
    if (a.charges.some(c => !c.cancelled && c.sourceId === s.id && c.periodStart! <= periodEnd && c.periodEnd! >= periodStart)) throw new RentError("A charge already covers part of this manual period.");
    const c = { id: `manual:${s.id}:${periodStart}:${periodEnd}`, accountId: a.id, sourceId: s.id, category: s.kind, description: s.name, periodStart, periodEnd, dueDate, amountPence, coverageKnown: true };
    a.charges.push(c); audit(a, user.userId, "manual_charge_created", c);
  }, version(f)); refresh();
}
export async function enablePortal(f: FormData) {
  const { savePortalAccess } = await import("../tenant-portal/actions");
  const result = await savePortalAccess(f);
  if (!result.ok) throw new RentError(result.error);
}
function applyCredit(a: LedgerAccount, input: PaymentInput, paymentId: string) {
  const p = a.payments.find(p => p.id === paymentId && !p.reversedAt && p.receivedDate <= today()); if (!p) throw new RentError("Available credit entry not found.");
  const available = p.amountPence - p.allocations.reduce((n, x) => n + x.amountPence, 0);
  if (input.amountPence !== available) throw new RentError("Available credit changed. Refresh and review again.");
  const charges = chargesWithProjections(a); validatePayment(a, input, charges);
  const ids = new Set(a.charges.map(c => c.id)); a.charges.push(...charges.filter(c => !ids.has(c.id) && input.allocations.some(x => x.chargeId === c.id)));
  p.allocations.push(...input.allocations.map(x => ({ ...x })));
  // Multiple credit applications to one charge are combined for a single allocation record.
  p.allocations = [...new Set(p.allocations.map(x => x.chargeId))].map(chargeId => ({ chargeId, amountPence: p.allocations.filter(x => x.chargeId === chargeId).reduce((n, x) => n + x.amountPence, 0) }));
  return a;
}
export async function previewCredit(input: PaymentInput, paymentId: string) {
  await requireAdminSession(); const a = (await getLedgerAccounts()).find(a => a.id === input.accountId);
  if (!a || a.version !== input.version) throw new RentError("Account changed; refresh and preview again.");
  applyCredit(a, input, paymentId);
  const { rentCoverage } = await import("./engine"); const coverage = rentCoverage(a);
  return { balances: balances(a), paidThrough: coverage.through, covered: coveredByAllocation(a, input.allocations), message: "Existing credit will be allocated. No new payment or SMS confirmation is created." };
}
export async function allocateCredit(input: PaymentInput, paymentId: string) {
  const user = await requireAdminSession(); await mutateAccount(input.accountId, a => {
    if (a.audit.some(e => e.type === "credit_allocated" && (e.detail as { requestId?: string }).requestId === input.requestId)) return;
    if (a.version !== input.version) throw new RentError("Account changed; refresh and preview again.");
    applyCredit(a, input, paymentId); audit(a, user.userId, "credit_allocated", { requestId: input.requestId, paymentId, allocations: input.allocations });
  }); refresh();
}

export async function createUnitRent(f: FormData) {
  const user=await requireAdminSession();
  const {getAppData}=await import("../data");const data=await getAppData();
  const unit=data.units.find(u=>u.id===value(f,"unitId"));if(!unit)throw new RentError("Choose a unit.");
  const requestId=value(f,"requestId"),startDate=value(f,"startDate"),frequency=value(f,"frequency");
  if(frequency!=="weekly"&&frequency!=="monthly")throw new RentError("Choose weekly or monthly rent.");
  const start=date(startDate);
  const schedule:Schedule={id:requestId,name:"Rent — Unit "+unit.unitReference,kind:"rent",frequency,startDate,dueDay:frequency==="weekly"?start.getUTCDay():start.getUTCDate(),timing:"advance",partialRule:"daily",enabled:true,rates:[{effectiveDate:startDate,amountPence:money(value(f,"amount"))}]};
  await setUpUnitRentAccount({parentId:value(f,"parentId"),version:version(f),requestId,unitId:unit.id,unitReference:unit.unitReference,sourceVersion:f.has("sourceVersion")?Number(value(f,"sourceVersion")):undefined,confirmMove:f.get("confirmMove")==="on",schedule},user.userId);
  refresh();
}

export async function linkExistingRentAccount(f:FormData){
  const user=await requireAdminSession();
  if(f.get("confirmed")!=="on")throw new RentError("Confirm these rent accounts belong to the same tenant.");
  let selected:unknown;try{selected=JSON.parse(value(f,"accountToLink"));}catch{throw new RentError("Choose a rent account to link.");}
  if(!Array.isArray(selected)||selected.length!==2||typeof selected[0]!=="string"||!Number.isInteger(selected[1]))throw new RentError("Choose a valid rent account.");
  await groupExistingRentAccount(value(f,"parentId"),version(f),selected[0],selected[1],user.userId);refresh();
}

export async function removeRentAccount(f: FormData) {
  const user = await requireAdminSession();
  if (value(f, "confirmed") !== "on") throw new RentError("Confirm that you want to remove this rent account.");
  await archiveRentAccount(value(f, "accountId"), version(f), user.userId);
  refresh();
}
