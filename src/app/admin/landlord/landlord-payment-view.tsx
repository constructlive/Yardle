"use client";

import { useMemo, useState } from "react";
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
  totalDuePence: number;
  amountPaidPence: number;
  remainingBalancePence: number;
  paidStatus: PaidStatus;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  notes: string;
  selected: boolean;
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

function createRows(rows: LandlordRow[]): PaymentRow[] {
  return rows.map(({ bill, unit, payments }) => {
    const active = activePayments(payments);
    const latest = active[0];
    return {
      billId: bill.id,
      unitReference: unit?.unitReference ?? "Deleted unit",
      tenantName: unit?.tenantName || "Vacant",
      totalDuePence: bill.roundedTotalPence,
      amountPaidPence: bill.amountPaidPence,
      remainingBalancePence: bill.remainingBalancePence,
      paidStatus: bill.paidStatus,
      paymentMethod: toUiMethod(latest?.paymentMethod),
      paymentDate: bill.paymentDate ?? latest?.paymentDate ?? "",
      notes: bill.adminNotes ?? latest?.notes ?? "",
      selected: false,
      payments,
      reversalPaymentId: active[0]?.id ?? ""
    };
  }).sort((left, right) => compareUnitReferences(left.unitReference, right.unitReference));
}

function csvEscape(value: string | number) { return `"${String(value).replaceAll('"', '""')}"`; }
function activePaymentLabel(payment: Payment) { return `${formatMoney(payment.amountPence)} on ${payment.paymentDate}`; }

export function LandlordPaymentView({ period, rows, initialFilter = "all" }: { period?: BillingPeriod; rows: LandlordRow[]; initialFilter?: Filter }) {
  const [payments, setPayments] = useState<PaymentRow[]>(() => createRows(rows));
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

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

  async function persistRow(row: PaymentRow) {
    if (row.amountPaidPence > 0 && !row.paymentMethod) { updateRow(row.billId, (current) => ({ ...current, warning: "Choose a payment method." })); return; }
    const result = await savePaymentUpdate({ billId: row.billId, amountPaidPence: row.amountPaidPence, paymentMethod: row.paymentMethod, paymentDate: row.paymentDate || today(), notes: row.notes });
    if (result && !result.ok) { setNotice(result.message); updateRow(row.billId, (current) => ({ ...current, warning: result.message })); }
  }

  function setPaid(billId: string, checked: boolean) {
    updateRow(billId, (row) => {
      if (checked && !row.paymentMethod) return { ...row, selected: true, warning: "Choose a payment method before marking paid." };
      const next = checked ? { ...row, selected: true, amountPaidPence: row.totalDuePence, remainingBalancePence: 0, paidStatus: "paid" as const, paymentDate: row.paymentDate || today(), warning: undefined } : { ...row, selected: false };
      if (checked) void persistRow(next);
      return next;
    });
  }

  function setAmountPaid(billId: string, value: string) {
    const amountPaidPence = Math.max(0, Math.round(Number(value || 0) * 100));
    updateRow(billId, (row) => ({ ...row, amountPaidPence, remainingBalancePence: Math.max(0, row.totalDuePence - amountPaidPence), paidStatus: statusForPayment(amountPaidPence, row.totalDuePence), selected: amountPaidPence > 0, paymentDate: amountPaidPence > 0 && !row.paymentDate ? today() : row.paymentDate, warning: undefined }));
  }

  function markSelectedPaid() {
    const selectedRows = payments.filter((row) => row.selected);
    if (!selectedRows.length) { setNotice("Select at least one bill first."); return; }
    if (selectedRows.some((row) => !row.paymentMethod)) { setPayments((current) => current.map((row) => row.selected && !row.paymentMethod ? { ...row, warning: "Choose a payment method." } : row)); setNotice("Choose a payment method for selected rows."); return; }
    setPayments((current) => current.map((row) => {
      if (!row.selected) return row;
      const next = { ...row, amountPaidPence: row.totalDuePence, remainingBalancePence: 0, paidStatus: "paid" as const, paymentDate: row.paymentDate || today(), warning: undefined };
      void persistRow(next);
      return next;
    }));
    setNotice(`${selectedRows.length} selected bill${selectedRows.length === 1 ? "" : "s"} marked as paid.`);
  }

  async function reverseSelectedPayment(row: PaymentRow) {
    const payment = activePayments(row.payments).find((item) => item.id === row.reversalPaymentId);
    if (!payment) return;
    const confirmed = window.confirm(`Reverse this ${formatMoney(payment.amountPence)} payment for Unit ${row.unitReference}?\n\nThis will add ${formatMoney(payment.amountPence)} back to the outstanding balance.`);
    if (!confirmed) return;
    const result = await reversePayment({ paymentId: payment.id, reason: "Landlord correction" });
    setNotice(result.message);
    if (!result.ok) return;
    updateRow(row.billId, (current) => {
      const nextPayments = current.payments.map((item) => item.id === payment.id ? { ...item, reversedAt: new Date().toISOString(), reversalReason: "Landlord correction" } : item);
      const totals = paymentTotals(current.totalDuePence, nextPayments);
      const active = activePayments(nextPayments);
      return { ...current, payments: nextPayments, ...totals, paymentDate: totals.paymentDate ?? "", reversalPaymentId: active[0]?.id ?? "", selected: false };
    });
  }

  function sendSelectedReminders() { const selectedUnpaid = payments.filter((row) => row.selected && row.remainingBalancePence > 0); selectedUnpaid.forEach((row) => void saveReminderForBill(row.billId)); setNotice(`${selectedUnpaid.length} reminder${selectedUnpaid.length === 1 ? "" : "s"} queued.`); }
  function exportCsv() { const header = ["unit", "tenant", "total due", "amount paid", "remaining balance", "payment method", "payment date", "notes"]; const body = visibleRows.map((row) => [row.unitReference, row.tenantName, (row.totalDuePence / 100).toFixed(2), (row.amountPaidPence / 100).toFixed(2), (row.remainingBalancePence / 100).toFixed(2), row.paymentMethod, row.paymentDate, row.notes]); void navigator.clipboard?.writeText([header, ...body].map((line) => line.map(csvEscape).join(",")).join("\n")); setNotice("Payment list CSV copied to clipboard."); }

  return <div className="space-y-4"><header className="flex flex-col gap-1"><p className="text-xs font-black uppercase tracking-[0.18em] text-estate-500">Landlord View</p><h1 className="text-2xl font-black text-ink md:text-3xl">Simple Payment Checklist</h1></header>
    <section className="flex flex-wrap gap-2">{[["Current billing period", period?.name ?? "No active period"], ["Total outstanding", formatMoney(summary.totalOutstanding)], ["Total paid this period", formatMoney(summary.totalPaid)], ["Unpaid bills", summary.unpaid], ["Paid bills", summary.paid]].map(([label, value]) => <div key={label} className="min-w-[10rem] rounded-xl border border-slateLine bg-card px-4 py-3 shadow-soft"><p className="text-[11px] font-black uppercase text-mutedText">{label}</p><p className="mt-1 text-lg font-black text-ink">{value}</p></div>)}</section>
    <section className="rounded-xl border border-slateLine bg-card p-3 shadow-soft"><div className="flex flex-wrap items-center gap-2">{filters.map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`rounded-xl px-3 py-2 text-sm font-black ${filter === value ? "bg-estate-500 text-[#07110b]" : "border border-slateLine bg-sidebar text-secondaryText hover:bg-hover"}`}>{label}</button>)}<label className="relative min-w-64 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mutedText" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 w-full rounded-xl border border-slateLine bg-sidebar pl-10 pr-3 text-sm font-bold text-ink outline-none focus:border-estate-500" placeholder="Search unit, tenant, or amount" /></label><button onClick={markSelectedPaid} className="rounded-xl bg-estate-500 px-3 py-2 text-sm font-black text-[#07110b]">Mark selected as paid</button><button onClick={sendSelectedReminders} className="rounded-xl border border-slateLine bg-sidebar px-3 py-2 text-sm font-black text-secondaryText">Send reminder</button><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-slateLine bg-sidebar px-3 py-2 text-sm font-black text-secondaryText"><Download className="h-4 w-4" />Export CSV</button></div>{notice ? <div className="mt-3 rounded-xl border border-estate-500/30 bg-estate-500/10 px-3 py-2 text-sm font-bold text-estate-500">{notice}</div> : null}</section>
    <section className="overflow-x-auto rounded-xl border border-slateLine bg-card shadow-soft"><table className="min-w-[1180px] w-full table-fixed divide-y divide-slateLine text-left text-xs [&_tbody_tr:nth-child(even)]:bg-white/[0.025] [&_tbody_tr:hover]:bg-hover"><thead className="sticky top-[57px] z-[1] bg-sidebar"><tr>{["Paid", "Unit", "Tenant", "Total due", "Amount paid", "Remaining balance", "Payment method", "Payment date", "Notes", "Action"].map((heading) => <th key={heading} className="px-2 py-2 font-black text-secondaryText">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slateLine">{visibleRows.map((row) => { const active = activePayments(row.payments); return <tr key={row.billId}><td className="w-14 px-2 py-2"><input type="checkbox" checked={row.selected || row.paidStatus === "paid"} onChange={(event) => setPaid(row.billId, event.target.checked)} className="h-5 w-5 accent-estate-500" /></td><td className="w-16 px-2 py-2 text-base font-black text-ink">{row.unitReference}</td><td className="w-44 px-2 py-2 font-bold text-secondaryText">{row.tenantName}</td><td className="w-24 px-2 py-2 font-black text-ink">{formatMoney(row.totalDuePence)}</td><td className="w-28 px-2 py-2"><input value={(row.amountPaidPence / 100).toFixed(2)} onChange={(event) => setAmountPaid(row.billId, event.target.value)} onBlur={() => void persistRow(row)} inputMode="decimal" className="h-9 w-full rounded-lg border border-slateLine bg-sidebar px-2 font-black text-ink outline-none focus:border-estate-500" /></td><td className="w-28 px-2 py-2 font-black text-amber-400">{formatMoney(row.remainingBalancePence)}</td><td className="w-36 px-2 py-2"><select value={row.paymentMethod} onChange={(event) => updateRow(row.billId, (current) => ({ ...current, paymentMethod: event.target.value as PaymentMethod, warning: undefined }))} onBlur={() => void persistRow(row)} className="h-9 w-full rounded-lg border border-slateLine bg-sidebar px-2 font-bold text-ink outline-none focus:border-estate-500">{methodOptions.map((method) => <option key={method} value={method}>{method || "Choose"}</option>)}</select>{row.warning ? <p className="mt-1 text-[11px] font-bold text-amber-400">{row.warning}</p> : null}</td><td className="w-32 px-2 py-2"><input type="date" value={row.paymentDate} onChange={(event) => updateRow(row.billId, (current) => ({ ...current, paymentDate: event.target.value }))} onBlur={() => void persistRow(row)} className="h-9 w-full rounded-lg border border-slateLine bg-sidebar px-2 font-bold text-ink outline-none focus:border-estate-500" /></td><td className="w-44 px-2 py-2"><input value={row.notes} onChange={(event) => updateRow(row.billId, (current) => ({ ...current, notes: event.target.value }))} onBlur={() => void persistRow(row)} className="h-9 w-full rounded-lg border border-slateLine bg-sidebar px-2 font-bold text-ink outline-none focus:border-estate-500" placeholder="Note" /></td><td className="w-44 px-2 py-2">{active.length ? <div className="flex gap-2"><select value={row.reversalPaymentId} onChange={(event) => updateRow(row.billId, (current) => ({ ...current, reversalPaymentId: event.target.value }))} className="h-9 min-w-0 flex-1 rounded-lg border border-slateLine bg-sidebar px-2 font-bold text-ink"><option value="">Payment</option>{active.map((payment) => <option key={payment.id} value={payment.id}>{activePaymentLabel(payment)}</option>)}</select><button onClick={() => void reverseSelectedPayment(row)} className="grid h-9 w-9 place-items-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-300" title="Reverse payment"><RotateCcw className="h-4 w-4" /></button></div> : <span className="text-mutedText">No payment</span>}</td></tr>; })}</tbody></table></section></div>;
}