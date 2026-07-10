"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CheckCircle2, Download, RotateCcw, Search } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { paymentTotals } from "@/lib/payment-accounting";
import { savePaymentUpdate, saveReminderForBill, reversePayment } from "@/lib/actions";
import { compareUnitReferences } from "@/lib/unit-sort";
import type { Bill, BillingPeriod, PaidStatus, Payment, Unit } from "@/lib/types";

type PaymentMethod = "" | "Cash" | "Bank Transfer" | "Card" | "Cheque" | "Other";
type Filter = "all" | "paid" | "unpaid" | "part_paid" | "outstanding";

interface LandlordRow {
  bill: Bill;
  unit?: Unit;
  payments: Payment[];
}

interface PaymentRow {
  billId: string;
  unitReference: string;
  tenantName: string;
  periodName: string;
  totalDuePence: number;
  amountPaidPence: number;
  amountPaidInput: string;
  remainingBalancePence: number;
  paidStatus: PaidStatus;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  notes: string;
  payments: Payment[];
  reversalPaymentId: string;
  warning?: string;
}

const methodOptions: PaymentMethod[] = ["", "Cash", "Bank Transfer", "Card", "Cheque", "Other"];
const filters: Array<[Filter, string]> = [["all", "All"], ["paid", "Paid"], ["unpaid", "Unpaid"], ["part_paid", "Part Paid"], ["outstanding", "Outstanding only"]];

function today() { return new Date().toISOString().slice(0, 10); }
function toUiMethod(method?: string): PaymentMethod { if (method === "cash") return "Cash"; if (method === "bank_transfer") return "Bank Transfer"; if (method === "card") return "Card"; if (method === "other") return "Other"; return ""; }
function statusForPayment(amountPaidPence: number, totalDuePence: number): PaidStatus { return amountPaidPence >= totalDuePence ? "paid" : amountPaidPence > 0 ? "part_paid" : "unpaid"; }
function activePayments(payments: Payment[]) { return payments.filter((payment) => !payment.reversedAt); }
function csvEscape(value: string | number) { return `"${String(value).replaceAll('"', '""')}"`; }
function activePaymentLabel(payment: Payment) { return `${formatMoney(payment.amountPence)} on ${payment.paymentDate}`; }

function createRows(rows: LandlordRow[], period?: BillingPeriod): PaymentRow[] {
  return rows.map(({ bill, unit, payments }) => {
    const active = activePayments(payments);
    const latest = active[0];
    return {
      billId: bill.id,
      unitReference: unit?.unitReference ?? "Deleted unit",
      tenantName: unit?.tenantName || "Vacant",
      periodName: period?.name ?? "No active period",
      totalDuePence: bill.roundedTotalPence,
      amountPaidPence: bill.amountPaidPence,
      amountPaidInput: (bill.amountPaidPence / 100).toFixed(2),
      remainingBalancePence: bill.remainingBalancePence,
      paidStatus: bill.paidStatus,
      paymentMethod: toUiMethod(latest?.paymentMethod),
      paymentDate: bill.paymentDate ?? latest?.paymentDate ?? today(),
      notes: bill.adminNotes ?? latest?.notes ?? "",
      payments,
      reversalPaymentId: active[0]?.id ?? ""
    };
  }).sort((left, right) => compareUnitReferences(left.unitReference, right.unitReference));
}

export function LandlordPaymentView({ period, rows, initialFilter = "all" }: { period?: BillingPeriod; rows: LandlordRow[]; initialFilter?: Filter }) {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRow[]>(() => createRows(rows, period));
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [paymentModal, setPaymentModal] = useState<PaymentRow | null>(null);
  const [reverseModal, setReverseModal] = useState<{ row: PaymentRow; payment: Payment } | null>(null);
  const [modalError, setModalError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setPayments(createRows(rows, period));
  }, [period, rows]);

  const summary = useMemo(() => ({
    totalOutstanding: payments.reduce((sum, row) => sum + row.remainingBalancePence, 0),
    totalPaid: payments.reduce((sum, row) => sum + row.amountPaidPence, 0),
    unpaid: payments.filter((row) => row.paidStatus === "unpaid").length,
    paid: payments.filter((row) => row.paidStatus === "paid").length
  }), [payments]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return payments.filter((row) => {
      const matchesFilter = filter === "all" || row.paidStatus === filter || (filter === "outstanding" && row.remainingBalancePence > 0);
      const searchable = `${row.unitReference} ${row.tenantName} ${(row.totalDuePence / 100).toFixed(2)} ${(row.amountPaidPence / 100).toFixed(2)} ${(row.remainingBalancePence / 100).toFixed(2)}`.toLowerCase();
      return matchesFilter && (!query || searchable.includes(query));
    }).sort((left, right) => compareUnitReferences(left.unitReference, right.unitReference));
  }, [filter, payments, search]);

  function updateRow(billId: string, updater: (row: PaymentRow) => PaymentRow) { setPayments((current) => current.map((row) => row.billId === billId ? updater(row) : row)); }
  function normaliseAmount(value: string) { return value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"); }
  function amountToPence(value: string) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0; }

  function setAmountPaid(billId: string, value: string) {
    const amountPaidInput = normaliseAmount(value);
    const amountPaidPence = amountToPence(amountPaidInput);
    updateRow(billId, (row) => ({ ...row, amountPaidInput, amountPaidPence, remainingBalancePence: Math.max(0, row.totalDuePence - amountPaidPence), paidStatus: statusForPayment(amountPaidPence, row.totalDuePence), paymentDate: amountPaidPence > 0 && !row.paymentDate ? today() : row.paymentDate, warning: undefined }));
  }

  function finishAmountEdit(row: PaymentRow) {
    const amountPaidPence = amountToPence(row.amountPaidInput);
    updateRow(row.billId, (current) => ({ ...current, amountPaidPence, amountPaidInput: (amountPaidPence / 100).toFixed(2), remainingBalancePence: Math.max(0, current.totalDuePence - amountPaidPence), paidStatus: statusForPayment(amountPaidPence, current.totalDuePence) }));
  }

  function openRecordPayment(row: PaymentRow) {
    const amountPaidPence = row.amountPaidPence > 0 ? row.amountPaidPence : row.totalDuePence;
    const next = {
      ...row,
      amountPaidPence,
      amountPaidInput: (amountPaidPence / 100).toFixed(2),
      remainingBalancePence: Math.max(0, row.totalDuePence - amountPaidPence),
      paidStatus: statusForPayment(amountPaidPence, row.totalDuePence),
      paymentDate: row.paymentDate || today(),
      warning: undefined
    };
    updateRow(row.billId, () => next);
    setModalError("");
    setPaymentModal(next);
  }

  function confirmPayment() {
    if (!paymentModal) return;
    if (paymentModal.amountPaidPence <= 0) { setModalError("Enter a payment amount before recording payment."); return; }
    if (!paymentModal.paymentMethod) { setModalError("Choose a payment method before recording payment."); return; }
    if (!paymentModal.paymentDate) { setModalError("Choose a payment date before recording payment."); return; }
    const row = paymentModal;
    startTransition(async () => {
      const result = await savePaymentUpdate({ billId: row.billId, amountPaidPence: row.amountPaidPence, paymentMethod: row.paymentMethod, paymentDate: row.paymentDate, notes: row.notes });
      if (!result.ok) { setModalError(result.message); return; }
      setPayments((current) => current.map((item) => item.billId === row.billId ? { ...row, warning: undefined } : item));
      setPaymentModal(null);
      setNotice(`Payment recorded for Unit ${row.unitReference}.`);
      router.refresh();
    });
  }

  function openReversePayment(row: PaymentRow) {
    const payment = activePayments(row.payments).find((item) => item.id === row.reversalPaymentId);
    if (!payment) { updateRow(row.billId, (current) => ({ ...current, warning: "Choose a payment to reverse." })); return; }
    setModalError("");
    setReverseModal({ row, payment });
  }

  function confirmReversePayment() {
    if (!reverseModal) return;
    const { row, payment } = reverseModal;
    startTransition(async () => {
      const result = await reversePayment({ paymentId: payment.id, reason: "Payment Checklist correction" });
      if (!result.ok) { setModalError(result.message); return; }
      updateRow(row.billId, (current) => {
        const nextPayments = current.payments.map((item) => item.id === payment.id ? { ...item, reversedAt: new Date().toISOString(), reversalReason: "Payment Checklist correction" } : item);
        const totals = paymentTotals(current.totalDuePence, nextPayments);
        const active = activePayments(nextPayments);
        return { ...current, payments: nextPayments, ...totals, amountPaidInput: (totals.amountPaidPence / 100).toFixed(2), paymentDate: totals.paymentDate ?? today(), reversalPaymentId: active[0]?.id ?? "", warning: undefined };
      });
      setReverseModal(null);
      setNotice(`Payment reversed for Unit ${row.unitReference}. Outstanding balance restored.`);
      router.refresh();
    });
  }

  function sendReminder(row: PaymentRow) {
    startTransition(async () => {
      await saveReminderForBill(row.billId);
      setNotice(`Reminder queued for Unit ${row.unitReference}.`);
      router.refresh();
    });
  }

  function exportCsv() {
    const header = ["unit", "tenant", "total due", "amount paid", "remaining balance", "payment method", "payment date", "notes"];
    const body = visibleRows.map((row) => [row.unitReference, row.tenantName, (row.totalDuePence / 100).toFixed(2), (row.amountPaidPence / 100).toFixed(2), (row.remainingBalancePence / 100).toFixed(2), row.paymentMethod, row.paymentDate, row.notes]);
    const csv = [header, ...body].map((line) => line.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `yardle-payment-checklist-${period?.name?.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "selected-period"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Payment list CSV downloaded.");
  }

  return <div className="space-y-4"><header className="flex flex-col gap-1"><p className="text-xs font-black uppercase tracking-[0.18em] text-estate-500">Payment Checklist</p><h1 className="text-2xl font-black text-ink md:text-3xl">Payment Checklist</h1></header>
    <section className="flex flex-wrap gap-2">{[["Selected billing period", period?.name ?? "No active period"], ["Total outstanding", formatMoney(summary.totalOutstanding)], ["Total paid this period", formatMoney(summary.totalPaid)], ["Unpaid bills", summary.unpaid], ["Paid bills", summary.paid]].map(([label, value]) => <div key={label} className="min-w-[10rem] rounded-xl border border-slateLine bg-card px-4 py-3 shadow-soft"><p className="text-[11px] font-black uppercase text-mutedText">{label}</p><p className="mt-1 text-lg font-black text-ink">{value}</p></div>)}</section>
    <section className="rounded-xl border border-slateLine bg-card p-3 shadow-soft"><div className="flex flex-wrap items-center gap-2">{filters.map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`rounded-xl px-3 py-2 text-sm font-black ${filter === value ? "bg-estate-500 text-[#07110b]" : "border border-slateLine bg-sidebar text-secondaryText hover:bg-hover"}`}>{label}</button>)}<label className="relative min-w-64 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mutedText" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 w-full rounded-xl border border-slateLine bg-sidebar pl-10 pr-3 text-sm font-bold text-ink outline-none focus:border-estate-500" placeholder="Search unit, tenant, or amount" /></label><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-slateLine bg-sidebar px-3 py-2 text-sm font-black text-secondaryText"><Download className="h-4 w-4" />Export CSV</button></div>{notice ? <div className="mt-3 rounded-xl border border-estate-500/30 bg-estate-500/10 px-3 py-2 text-sm font-bold text-estate-500">{notice}</div> : null}</section>
    <section className="max-h-[calc(100dvh-20rem)] overflow-auto rounded-xl border border-slateLine bg-card shadow-soft"><table className="min-w-[1180px] w-full table-fixed divide-y divide-slateLine text-left text-xs [&_tbody_tr:nth-child(even)]:bg-white/[0.025] [&_tbody_tr:hover]:bg-hover"><thead className="sticky top-0 z-30 bg-sidebar shadow-[0_1px_0_#2D333A]"><tr>{["Status", "Unit", "Tenant", "Total due", "Amount paid", "Remaining balance", "Payment method", "Payment date", "Notes", "Action"].map((heading) => <th key={heading} className="bg-sidebar px-2 py-3 font-black text-secondaryText">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slateLine">{visibleRows.map((row) => { const active = activePayments(row.payments); return <tr key={row.billId}><td className="w-20 px-2 py-2"><span className={`rounded-full px-2 py-1 text-[11px] font-black ${row.paidStatus === "paid" ? "bg-estate-500/15 text-estate-500" : row.paidStatus === "part_paid" ? "bg-amber-500/15 text-amber-300" : "bg-red-500/15 text-red-300"}`}>{row.paidStatus.replace("_", " ")}</span></td><td className="w-16 px-2 py-2 text-base font-black text-ink">{row.unitReference}</td><td className="w-44 px-2 py-2 font-bold text-secondaryText">{row.tenantName}</td><td className="w-24 px-2 py-2 font-black text-ink">{formatMoney(row.totalDuePence)}</td><td className="w-28 px-2 py-2"><input value={row.amountPaidInput} onChange={(event) => setAmountPaid(row.billId, event.target.value)} onBlur={() => finishAmountEdit(row)} inputMode="decimal" className="h-9 w-full rounded-lg border border-slateLine bg-sidebar px-2 font-black text-ink outline-none focus:border-estate-500" /></td><td className="w-28 px-2 py-2 font-black text-amber-400">{formatMoney(row.remainingBalancePence)}</td><td className="w-36 px-2 py-2"><select value={row.paymentMethod} onChange={(event) => updateRow(row.billId, (current) => ({ ...current, paymentMethod: event.target.value as PaymentMethod, warning: undefined }))} className="h-9 w-full rounded-lg border border-slateLine bg-sidebar px-2 font-bold text-ink outline-none focus:border-estate-500">{methodOptions.map((method) => <option key={method} value={method}>{method || "Choose"}</option>)}</select>{row.warning ? <p className="mt-1 text-[11px] font-bold text-amber-400">{row.warning}</p> : null}</td><td className="w-32 px-2 py-2"><input type="date" value={row.paymentDate} onChange={(event) => updateRow(row.billId, (current) => ({ ...current, paymentDate: event.target.value }))} className="h-9 w-full rounded-lg border border-slateLine bg-sidebar px-2 font-bold text-ink outline-none focus:border-estate-500" /></td><td className="w-44 px-2 py-2"><input value={row.notes} onChange={(event) => updateRow(row.billId, (current) => ({ ...current, notes: event.target.value }))} className="h-9 w-full rounded-lg border border-slateLine bg-sidebar px-2 font-bold text-ink outline-none focus:border-estate-500" placeholder="Note" /></td><td className="w-56 px-2 py-2"><div className="flex items-center gap-2">{row.remainingBalancePence > 0 ? <button onClick={() => openRecordPayment(row)} className="inline-flex h-9 items-center gap-1 rounded-lg bg-estate-500 px-3 text-xs font-black text-[#07110b]"><CheckCircle2 className="h-4 w-4" />Record</button> : null}{row.remainingBalancePence > 0 ? <button onClick={() => sendReminder(row)} className="grid h-9 w-9 place-items-center rounded-lg border border-slateLine bg-sidebar text-secondaryText" title="Send reminder"><BellRing className="h-4 w-4" /></button> : null}{active.length ? <><select value={row.reversalPaymentId} onChange={(event) => updateRow(row.billId, (current) => ({ ...current, reversalPaymentId: event.target.value }))} className="h-9 min-w-0 flex-1 rounded-lg border border-slateLine bg-sidebar px-2 font-bold text-ink"><option value="">Payment</option>{active.map((payment) => <option key={payment.id} value={payment.id}>{activePaymentLabel(payment)}</option>)}</select><button onClick={() => openReversePayment(row)} className="grid h-9 w-9 place-items-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-300" title="Reverse payment"><RotateCcw className="h-4 w-4" /></button></> : row.remainingBalancePence <= 0 ? <span className="text-mutedText">No active payment</span> : null}</div></td></tr>; })}</tbody></table></section>
    {paymentModal ? <ConfirmationModal title="Record payment" error={modalError} busy={isPending} confirmLabel="Confirm payment" onCancel={() => setPaymentModal(null)} onConfirm={confirmPayment}><Detail label="Unit" value={paymentModal.unitReference} /><Detail label="Tenant" value={paymentModal.tenantName} /><Detail label="Billing period" value={paymentModal.periodName} /><Detail label="Amount" value={formatMoney(paymentModal.amountPaidPence)} /><Detail label="Payment date" value={paymentModal.paymentDate} /><Detail label="Payment method" value={paymentModal.paymentMethod || "Not selected"} /><p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-bold text-amber-200">This will save the payment once and update the remaining balance after the database transaction succeeds.</p></ConfirmationModal> : null}
    {reverseModal ? <ConfirmationModal title="Reverse payment" error={modalError} busy={isPending} confirmLabel="Reverse payment" danger onCancel={() => setReverseModal(null)} onConfirm={confirmReversePayment}><Detail label="Unit" value={reverseModal.row.unitReference} /><Detail label="Tenant" value={reverseModal.row.tenantName} /><Detail label="Amount to restore" value={formatMoney(reverseModal.payment.amountPence)} /><Detail label="Payment date" value={reverseModal.payment.paymentDate} /><Detail label="Method" value={reverseModal.payment.paymentMethod.replace("_", " ")} /><p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-200">This keeps the original payment in the audit trail and restores the outstanding balance.</p></ConfirmationModal> : null}
  </div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slateLine bg-sidebar p-3"><p className="text-[11px] font-black uppercase tracking-[0.12em] text-mutedText">{label}</p><p className="mt-1 text-base font-black text-ink">{value}</p></div>;
}

function ConfirmationModal({ title, children, error, busy, confirmLabel, danger, onCancel, onConfirm }: { title: string; children: ReactNode; error: string; busy: boolean; confirmLabel: string; danger?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-xl rounded-2xl border border-slateLine bg-card p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><h2 className="text-2xl font-black text-ink">{title}</h2><button onClick={onCancel} className="rounded-xl border border-slateLine bg-sidebar px-3 py-2 text-sm font-black text-secondaryText">Close</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div>{error ? <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-200">{error}</div> : null}<div className="mt-5 flex justify-end gap-3"><button onClick={onCancel} disabled={busy} className="rounded-xl border border-slateLine bg-sidebar px-4 py-3 text-sm font-black text-secondaryText disabled:opacity-60">Cancel</button><button onClick={onConfirm} disabled={busy} className={`rounded-xl px-4 py-3 text-sm font-black disabled:cursor-wait disabled:opacity-70 ${danger ? "bg-red-500 text-white" : "bg-estate-500 text-[#07110b] shadow-glow"}`}>{busy ? "Saving" : confirmLabel}</button></div></div></div>;
}
