"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { rentBookRows } from "@/lib/rent-ledger/rent-book";
import { chargeRemaining, money, today } from "@/lib/rent-ledger/engine";
import { previewReceipt, recordReceipt } from "@/lib/rent-ledger/ui-actions";
import { accountPath } from "@/lib/rent-ledger/links";
import { formatMoney } from "@/lib/money";
import type { LedgerAccount, PaymentInput } from "@/lib/rent-ledger/types";

const field = "mt-1 w-full rounded-xl border border-slateLine bg-sidebar p-3 text-ink";
const button = "rounded-xl bg-amber-400 px-4 py-3 font-bold text-slate-950 disabled:opacity-40";
const displayDate = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value + "T12:00:00Z"));

export function RentBook({ account }: { account: LedgerAccount }) {
  const router = useRouter();
  const rows = rentBookRows(account);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [selected, setSelected] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [receivedDate, setReceivedDate] = useState(today());
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [preview, setPreview] = useState<{ input: PaymentInput; credit: number }>();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const visible = rows.filter(row => !month || (row.from.slice(0, 7) <= month && row.to.slice(0, 7) >= month));
  const chosen = rows.filter(row => selected.includes(row.id));
  const total = chosen.reduce((sum, row) => sum + row.remaining, 0);

  function choose(ids: string[]) {
    setSelected(ids); setAmount((rows.filter(row => ids.includes(row.id)).reduce((sum, row) => sum + row.remaining, 0) / 100).toFixed(2));
    setPreview(undefined); setError(""); setSaved("");
  }
  function build(): PaymentInput {
    const amountPence = money(amount); let available = amountPence;
    const allocations = chosen.flatMap(row => row.charges).map(charge => {
      const allocated = Math.min(Math.max(0, available), chargeRemaining(account, charge)); available -= allocated;
      return { chargeId: charge.id, amountPence: allocated };
    }).filter(item => item.amountPence > 0);
    return { accountId: account.id, version: account.version, requestId, amountPence, receivedDate, method, reference, allocations };
  }
  async function review() {
    setBusy(true); setError("");
    try { const input = build(); const result = await previewReceipt(input); if (!result.ok) throw new Error(result.error); setPreview({ input, credit: input.amountPence - input.allocations.reduce((sum, item) => sum + item.amountPence, 0) }); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function save() {
    if (!preview) return;
    setBusy(true); setError("");
    try {
      const result = await recordReceipt(preview.input); if (!result.ok) throw new Error(result.error);
      setSaved(formatMoney(result.value.amountPence) + " payment saved. The rent book has been updated.");
      setSelected([]); setPreview(undefined); setAmount(""); setReference(""); setRequestId(crypto.randomUUID()); router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return <section id="rent-book" className="space-y-4 rounded-2xl border border-slateLine bg-card p-5" aria-label="Rent book">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-black">Rent book</h2><p className="text-sm text-secondaryText">One line per rent period. A tick means that period is fully paid.</p></div><Link className="text-amber-200 underline" href={accountPath(account.id) + "/payment"}>Apply credit / other payment</Link></div>
    <fieldset disabled={busy} className="space-y-4">
      <div className="flex flex-wrap items-end gap-3"><label>Month<input type="month" className={field} value={month} onChange={event => { setMonth(event.target.value); choose([]); }} /></label><button type="button" className="min-h-11 underline" onClick={() => { setMonth(""); choose([]); }}>Show all periods</button><button type="button" className="min-h-11 text-amber-200 underline" onClick={() => choose(visible.filter(row => row.remaining > 0).map(row => row.id))}>Select unpaid periods shown</button>{selected.length > 0 && <button type="button" className="min-h-11 underline" onClick={() => choose([])}>Clear selection</button>}</div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Rent periods, payments and remaining amounts</caption><thead><tr>{["Select", "Rent period", "Rent", "Paid", "Left to pay", "Status"].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead><tbody>
        {visible.map(row => <tr key={row.id} className="border-t border-slateLine">
          <td className="p-3">{row.remaining > 0 ? <label className="flex min-h-11 min-w-11 items-center justify-center"><input type="checkbox" aria-label={"Select " + row.name + " from " + displayDate(row.from)} checked={selected.includes(row.id)} onChange={event => choose(event.target.checked ? [...selected, row.id] : selected.filter(id => id !== row.id))} /></label> : <span className="text-xl text-green-300" aria-label={row.status}>{row.status === "Paid" ? "✓" : "—"}</span>}</td>
          <td className="p-3"><p className="font-bold">{displayDate(row.from)}</p><p className="text-secondaryText">to {displayDate(row.to)}</p><p className="text-xs text-secondaryText">{row.name} · Due {displayDate(row.due)}</p><details className="mt-1"><summary className="cursor-pointer underline">Payment details</summary>{account.payments.filter(payment => !payment.reversedAt && payment.allocations.some(item => row.charges.some(charge => charge.id === item.chargeId))).map(payment => <p key={payment.id} className="py-1">{displayDate(payment.receivedDate)} · {formatMoney(payment.allocations.filter(item => row.charges.some(charge => charge.id === item.chargeId)).reduce((sum, item) => sum + item.amountPence, 0))} · {payment.method.replaceAll("_", " ")}{payment.reference ? " · " + payment.reference : ""}</p>)}{row.paid === 0 && <p>No payment allocated to this period.</p>}</details></td>
          <td className="p-3 tabular-nums">{formatMoney(row.amount)}</td><td className="p-3 tabular-nums">{formatMoney(row.paid)}</td><td className="p-3 tabular-nums">{formatMoney(row.remaining)}</td><td className={"p-3 font-bold " + (row.status === "Paid" ? "text-green-300" : row.status === "Unpaid" ? "text-amber-200" : "")}>{row.status === "Paid" ? "✓ Paid" : row.status}</td>
        </tr>)}
      </tbody></table></div>
      {!visible.length && <p>No rent periods in this view. Try another month or show all periods. Manual rent periods appear once entered.</p>}
      <p className="text-sm text-secondaryText">Earlier balances, services and electricity are separate. Existing credit only ticks a period once applied. Historical weeks without confirmed allocations are not marked paid.</p>
      {selected.length > 0 && <div className="space-y-4 border-t border-slateLine pt-4"><h3 className="text-lg font-bold">Record payment for {selected.length} selected {selected.length === 1 ? "period" : "periods"}</h3><p>Left to pay for selection: <b>{formatMoney(total)}</b>. A smaller payment covers the earliest selected periods first.</p>
        <div className="grid gap-3 sm:grid-cols-2"><label>Amount received (£)<input className={field} inputMode="decimal" value={amount} onChange={event => { setAmount(event.target.value); setPreview(undefined); }} /></label><label>Date received<input className={field} type="date" max={today()} value={receivedDate} onChange={event => { setReceivedDate(event.target.value); setPreview(undefined); }} /></label><label>Payment method<select className={field} value={method} onChange={event => { setMethod(event.target.value); setPreview(undefined); }}><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option></select></label><label>Reference (optional)<input className={field} value={reference} onChange={event => { setReference(event.target.value); setPreview(undefined); }} /></label></div>
        <button type="button" className={button} onClick={review}>Review payment</button>
        {preview && <div className="space-y-3" aria-live="polite"><p>Receive <b>{formatMoney(preview.input.amountPence)}</b> on {displayDate(preview.input.receivedDate)}.</p>{chosen.map(row => { const allocation = preview.input.allocations.filter(item => row.charges.some(charge => charge.id === item.chargeId)).reduce((sum, item) => sum + item.amountPence, 0); return <p key={row.id}>{displayDate(row.from)} · {row.name}: {formatMoney(allocation)} paid now · {formatMoney(row.remaining - allocation)} left</p>; })}{preview.credit > 0 && <p>{formatMoney(preview.credit)} will remain as account credit.</p>}<button type="button" className={button} onClick={save}>Confirm and save payment</button></div>}
      </div>}
    </fieldset>
    {error && <p role="alert" className="text-red-300">{error}</p>}{saved && <p role="status" className="text-green-300">{saved}</p>}
  </section>;
}
