"use client";

import { useMemo, useState } from "react";
import { BellRing, CheckCircle2, Download, MailWarning, Search, WalletCards } from "lucide-react";
import { StatCard, StatusPill } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { savePaymentUpdate, saveReminderForBill } from "@/lib/actions";
import type { Bill, BillingPeriod, PaidStatus, Payment, Unit } from "@/lib/types";

type PaymentMethod = "" | "Cash" | "Bank Transfer" | "Card" | "Cheque" | "Other";
type Filter = "all" | "paid" | "unpaid" | "part_paid" | "outstanding";

interface LandlordRow {
  bill: Bill;
  unit: Unit;
  payment?: Payment;
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
  hasExistingPayment: boolean;
  originalAmountPaidPence: number;
  originalPaymentDate: string;
  selected: boolean;
  warning?: string;
}

const methodOptions: PaymentMethod[] = ["", "Cash", "Bank Transfer", "Card", "Cheque", "Other"];
const filters: Array<[Filter, string]> = [
  ["all", "All"],
  ["paid", "Paid"],
  ["unpaid", "Unpaid"],
  ["part_paid", "Part Paid"],
  ["outstanding", "Outstanding only"]
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function statusForPayment(amountPaidPence: number, totalDuePence: number): PaidStatus {
  if (amountPaidPence >= totalDuePence) {
    return "paid";
  }
  if (amountPaidPence > 0) {
    return "part_paid";
  }
  return "unpaid";
}

function toUiMethod(method?: string): PaymentMethod {
  if (method === "cash") return "Cash";
  if (method === "bank_transfer") return "Bank Transfer";
  if (method === "card") return "Card";
  if (method === "other") return "Other";
  return "";
}
function createRows(rows: LandlordRow[]): PaymentRow[] {
  return rows.map(({ bill, unit, payment }) => ({
    billId: bill.id,
    unitReference: unit.unitReference,
    tenantName: unit.tenantName,
    totalDuePence: bill.roundedTotalPence,
    amountPaidPence: bill.amountPaidPence,
    remainingBalancePence: bill.remainingBalancePence,
    paidStatus: bill.paidStatus,
    paymentMethod: toUiMethod(payment?.paymentMethod),
    paymentDate: bill.paymentDate ?? payment?.paymentDate ?? "",
    notes: bill.adminNotes ?? "",
    hasExistingPayment: bill.amountPaidPence > 0,
    originalAmountPaidPence: bill.amountPaidPence,
    originalPaymentDate: bill.paymentDate ?? "",
    selected: false
  }));
}

function csvEscape(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function StatusBadge({ status }: { status: PaidStatus }) {
  if (status === "paid") {
    return <StatusPill tone="good">Paid</StatusPill>;
  }
  if (status === "part_paid") {
    return <StatusPill tone="warn">Part Paid</StatusPill>;
  }
  if (status === "credited") {
    return <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-bold text-blue-400 ring-1 ring-blue-500/25">Credited</span>;
  }
  return <StatusPill tone="bad">Unpaid</StatusPill>;
}

export function LandlordPaymentView({ period, rows, initialFilter = "all" }: { period: BillingPeriod; rows: LandlordRow[]; initialFilter?: Filter }) {
  const [payments, setPayments] = useState<PaymentRow[]>(() => createRows(rows));
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

  const summary = useMemo(() => {
    const totalOutstanding = payments.reduce((sum, row) => sum + row.remainingBalancePence, 0);
    const totalPaid = payments.reduce((sum, row) => sum + row.amountPaidPence, 0);
    const unpaid = payments.filter((row) => row.paidStatus === "unpaid").length;
    const paid = payments.filter((row) => row.paidStatus === "paid").length;
    return { totalOutstanding, totalPaid, unpaid, paid };
  }, [payments]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return payments.filter((row) => {
      const matchesFilter =
        filter === "all" ||
        row.paidStatus === filter ||
        (filter === "outstanding" && row.remainingBalancePence > 0);
      const searchable = `${row.unitReference} ${row.tenantName} ${(row.totalDuePence / 100).toFixed(2)} ${(row.amountPaidPence / 100).toFixed(2)} ${(row.remainingBalancePence / 100).toFixed(2)}`.toLowerCase();
      return matchesFilter && (!query || searchable.includes(query));
    });
  }, [filter, payments, search]);

  function updateRow(billId: string, updater: (row: PaymentRow) => PaymentRow) {
    setPayments((current) => current.map((row) => (row.billId === billId ? updater(row) : row)));
  }


  async function persistRow(row: PaymentRow) {
    if (row.amountPaidPence > 0 && !row.paymentMethod) {
      updateRow(row.billId, (current) => ({ ...current, warning: "Choose a payment method before saving payment." }));
      return;
    }
    await savePaymentUpdate({
      billId: row.billId,
      amountPaidPence: row.amountPaidPence,
      paymentMethod: row.paymentMethod || "Other",
      paymentDate: row.paymentDate || today(),
      notes: row.notes
    });
  }
  function setPaid(billId: string, checked: boolean) {
    updateRow(billId, (row) => {
      if (checked && !row.paymentMethod) {
        return { ...row, warning: "Choose a payment method before marking paid." };
      }
      if (checked) {
        const next = {
          ...row,
          amountPaidPence: row.totalDuePence,
          remainingBalancePence: 0,
          paidStatus: "paid" as const,
          paymentDate: today(),
          warning: undefined
        };
        void persistRow(next);
        return next;
      }
      if (row.hasExistingPayment) {
        const paidStatus = statusForPayment(row.originalAmountPaidPence, row.totalDuePence);
        const next = {
          ...row,
          amountPaidPence: row.originalAmountPaidPence,
          remainingBalancePence: Math.max(0, row.totalDuePence - row.originalAmountPaidPence),
          paidStatus,
          paymentDate: row.originalPaymentDate,
          warning: undefined
        };
        void persistRow(next);
        return next;
      }
      const next = {
        ...row,
        amountPaidPence: 0,
        remainingBalancePence: row.totalDuePence,
        paidStatus: "unpaid" as const,
        paymentDate: "",
        warning: undefined
      };
      void persistRow(next);
      return next;
    });
  }

  function setAmountPaid(billId: string, value: string) {
    const amountPaidPence = Math.max(0, Math.round(Number(value || 0) * 100));
    updateRow(billId, (row) => ({
      ...row,
      amountPaidPence,
      remainingBalancePence: Math.max(0, row.totalDuePence - amountPaidPence),
      paidStatus: statusForPayment(amountPaidPence, row.totalDuePence),
      paymentDate: amountPaidPence > 0 && !row.paymentDate ? today() : row.paymentDate,
      warning: undefined
    }));
  }

  function markSelectedPaid() {
    const selectedRows = payments.filter((row) => row.selected);
    const missingMethod = selectedRows.filter((row) => !row.paymentMethod);
    if (missingMethod.length > 0) {
      setPayments((current) => current.map((row) => (row.selected && !row.paymentMethod ? { ...row, warning: "Choose a payment method before marking paid." } : row)));
      setNotice("Choose a payment method for selected rows before marking them paid.");
      return;
    }
    setPayments((current) => current.map((row) => {
      if (!row.selected) return row;
      const next = {
        ...row,
        amountPaidPence: row.totalDuePence,
        remainingBalancePence: 0,
        paidStatus: "paid" as const,
        paymentDate: today(),
        warning: undefined
      };
      void persistRow(next);
      return next;
    }));
    setNotice(`${selectedRows.length} selected bill${selectedRows.length === 1 ? "" : "s"} marked as paid.`);
  }

  function sendSelectedReminders() {
    const selectedUnpaid = payments.filter((row) => row.selected && row.remainingBalancePence > 0);
    selectedUnpaid.forEach((row) => void saveReminderForBill(row.billId));
    const reminderCount = selectedUnpaid.length;
    setNotice(`${reminderCount} reminder${reminderCount === 1 ? "" : "s"} queued for selected unpaid tenants.`);
  }

  function exportCsv() {
    const header = ["unit", "tenant", "total due", "amount paid", "remaining balance", "payment method", "payment date", "status", "notes"];
    const body = payments.map((row) => [
      row.unitReference,
      row.tenantName,
      (row.totalDuePence / 100).toFixed(2),
      (row.amountPaidPence / 100).toFixed(2),
      (row.remainingBalancePence / 100).toFixed(2),
      row.paymentMethod,
      row.paymentDate,
      row.paidStatus,
      row.notes
    ]);
    const csv = [header, ...body].map((line) => line.map(csvEscape).join(",")).join("\n");
    void navigator.clipboard?.writeText(csv);
    setNotice("Payment list CSV copied to clipboard.");
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Current billing period" value={period.name} hint={period.status} icon={WalletCards} tone="blue" />
        <StatCard label="Total outstanding" value={formatMoney(summary.totalOutstanding)} hint="Remaining balances" icon={MailWarning} tone="warning" />
        <StatCard label="Total paid this period" value={formatMoney(summary.totalPaid)} hint="Recorded locally" icon={CheckCircle2} tone="green" />
        <StatCard label="Unpaid bills" value={summary.unpaid} hint="Needs attention" icon={BellRing} tone="danger" />
        <StatCard label="Paid bills" value={summary.paid} hint="Completed" icon={CheckCircle2} tone="green" />
      </section>

      <section className="rounded-2xl border border-slateLine bg-card p-4 shadow-soft">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {filters.map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`tap-target rounded-2xl px-4 py-3 text-sm font-black transition ${filter === value ? "bg-estate-500 text-[#07110b] shadow-glow" : "border border-slateLine bg-sidebar text-secondaryText hover:bg-hover hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative block min-w-72">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-mutedText" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="tap-target w-full rounded-2xl border border-slateLine bg-sidebar py-3 pl-12 pr-4 font-bold text-ink outline-none transition placeholder:text-mutedText focus:border-estate-500"
                placeholder="Search unit, tenant, or amount"
              />
            </label>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={markSelectedPaid} className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl bg-estate-500 px-5 py-3 text-base font-black text-[#07110b] shadow-glow transition hover:-translate-y-0.5 hover:bg-estate-600">
            <CheckCircle2 className="h-5 w-5" />
            Mark selected as paid
          </button>
          <button type="button" onClick={sendSelectedReminders} className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl border border-slateLine bg-card px-5 py-3 text-base font-black text-ink transition hover:-translate-y-0.5 hover:border-estate-500/50 hover:bg-hover">
            <BellRing className="h-5 w-5" />
            Send reminder to selected unpaid tenants
          </button>
          <button type="button" onClick={exportCsv} className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl border border-slateLine bg-card px-5 py-3 text-base font-black text-ink transition hover:-translate-y-0.5 hover:border-estate-500/50 hover:bg-hover">
            <Download className="h-5 w-5" />
            Export payment list CSV
          </button>
        </div>
        {notice ? <div className="mt-4 rounded-2xl border border-estate-500/30 bg-estate-500/10 px-4 py-3 text-sm font-bold text-estate-500">{notice}</div> : null}
      </section>

      <section className="overflow-x-auto rounded-2xl border border-slateLine bg-card shadow-soft">
        <table className="min-w-[92rem] divide-y divide-slateLine text-left text-sm [&_tbody_tr:nth-child(even)]:bg-white/[0.025] [&_tbody_tr:hover]:bg-hover">
          <thead className="sticky top-0 z-[1] bg-sidebar">
            <tr>
              <th className="px-4 py-4 font-black text-secondaryText">Select</th>
              <th className="px-4 py-4 font-black text-secondaryText">Paid</th>
              <th className="px-4 py-4 font-black text-secondaryText">Unit</th>
              <th className="px-4 py-4 font-black text-secondaryText">Tenant</th>
              <th className="px-4 py-4 font-black text-secondaryText">Total due</th>
              <th className="px-4 py-4 font-black text-secondaryText">Amount paid</th>
              <th className="px-4 py-4 font-black text-secondaryText">Remaining balance</th>
              <th className="px-4 py-4 font-black text-secondaryText">Payment method</th>
              <th className="px-4 py-4 font-black text-secondaryText">Payment date</th>
              <th className="px-4 py-4 font-black text-secondaryText">Status</th>
              <th className="px-4 py-4 font-black text-secondaryText">Notes</th>
              <th className="px-4 py-4 font-black text-secondaryText">Reminder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slateLine">
            {visibleRows.map((row) => (
              <tr key={row.billId}>
                <td className="px-4 py-4"><input type="checkbox" checked={row.selected} onChange={(event) => updateRow(row.billId, (current) => ({ ...current, selected: event.target.checked }))} className="h-6 w-6 accent-estate-500" /></td>
                <td className="px-4 py-4"><input type="checkbox" checked={row.paidStatus === "paid"} onChange={(event) => setPaid(row.billId, event.target.checked)} className="h-6 w-6 accent-estate-500" /></td>
                <td className="px-4 py-4 text-lg font-black text-ink">{row.unitReference}</td>
                <td className="px-4 py-4 font-bold text-secondaryText">{row.tenantName}</td>
                <td className="px-4 py-4 font-black text-ink">{formatMoney(row.totalDuePence)}</td>
                <td className="px-4 py-4">
                  <input
                    value={(row.amountPaidPence / 100).toFixed(2)}
                    onChange={(event) => setAmountPaid(row.billId, event.target.value)}
                    onBlur={() => void persistRow(row)}
                    inputMode="decimal"
                    className="w-32 rounded-xl border border-slateLine bg-sidebar p-3 font-black text-ink outline-none transition focus:border-estate-500"
                  />
                </td>
                <td className="px-4 py-4 font-black text-amber-400">{formatMoney(row.remainingBalancePence)}</td>
                <td className="px-4 py-4">
                  <select
                    value={row.paymentMethod}
                    onChange={(event) => {
                      const paymentMethod = event.target.value as PaymentMethod;
                      updateRow(row.billId, (current) => {
                        const next = { ...current, paymentMethod, warning: undefined };
                        void persistRow(next);
                        return next;
                      });
                    }}
                    className="tap-target w-44 rounded-xl border border-slateLine bg-sidebar p-3 font-bold text-ink outline-none transition focus:border-estate-500"
                  >
                    {methodOptions.map((method) => <option key={method} value={method}>{method || "Choose method"}</option>)}
                  </select>
                  {row.warning ? <p className="mt-2 max-w-44 text-xs font-bold text-amber-400">{row.warning}</p> : null}
                </td>
                <td className="px-4 py-4">
                  <input
                    type="date"
                    value={row.paymentDate}
                    onChange={(event) => {
                      const paymentDate = event.target.value;
                      updateRow(row.billId, (current) => {
                        const next = { ...current, paymentDate };
                        void persistRow(next);
                        return next;
                      });
                    }}
                    className="tap-target w-40 rounded-xl border border-slateLine bg-sidebar p-3 font-bold text-ink outline-none transition focus:border-estate-500"
                  />
                </td>
                <td className="px-4 py-4"><StatusBadge status={row.paidStatus} /></td>
                <td className="px-4 py-4">
                  <input
                    value={row.notes}
                    onChange={(event) => updateRow(row.billId, (current) => ({ ...current, notes: event.target.value }))}
                    onBlur={() => void persistRow(row)}
                    className="w-56 rounded-xl border border-slateLine bg-sidebar p-3 font-bold text-ink outline-none transition placeholder:text-mutedText focus:border-estate-500"
                    placeholder="Add note"
                  />
                </td>
                <td className="px-4 py-4">
                  <button
                    type="button"
                    onClick={() => {
                      void saveReminderForBill(row.billId);
                      setNotice(`Reminder queued for Unit ${row.unitReference}.`);
                    }}
                    className="tap-target rounded-xl border border-slateLine bg-sidebar px-4 py-3 font-black text-secondaryText transition hover:bg-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={row.remainingBalancePence === 0}
                  >
                    Reminder
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}










