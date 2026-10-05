import { notFound } from "next/navigation";
import { PrintStatement } from "@/components/rent-ledger/print-button";
import { getPortalAccount } from "@/lib/rent-ledger/store";
import { addDays, balances, today } from "@/lib/rent-ledger/engine";
import { formatMoney } from "@/lib/money";
export const dynamic = "force-dynamic";
export const metadata = { title: "Rent statement | Yardle", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function Statement({ params }: { params: { token: string } }) {
  if (!/^[a-f0-9]{64}$/.test(params.token)) notFound();
  const a = await getPortalAccount(params.token); if (!a) notFound();
  const rows = [
    ...a.charges.filter(c => !c.cancelled && c.dueDate <= today()).map(c => ({ id: c.id, date: c.dueDate, label: `${c.description}${c.periodStart ? ` (${c.periodStart} to ${c.periodEnd})` : ""}`, debit: c.amountPence, credit: 0 })),
    ...a.payments.filter(p => p.receivedDate <= today()).flatMap(p => [{ id: p.id, date: p.receivedDate, label: `Receipt: ${p.reference || p.method}`, debit: 0, credit: p.amountPence }, ...(p.reversedAt ? [{ id: `${p.id}:reversal`, date: p.reversedAt.slice(0,10), label: `Reversal: ${p.reversalReason}`, debit: p.amountPence, credit: 0 }] : [])])
  ].sort((x,y) => x.date.localeCompare(y.date) || y.debit - x.debit || x.id.localeCompare(y.id));
  let running = 0; const b = balances(a);
  return <main className="mx-auto max-w-5xl space-y-5 bg-white p-8 text-slate-950"><PrintStatement /><h1 className="text-3xl font-black">Rent account statement — {a.name}</h1><p>As at {today()} · Confirmed opening position through {a.approval ? addDays(a.approval.firstCoverageDate, -1) : "—"}. Electricity is excluded.</p><table className="w-full text-left text-sm"><thead><tr>{["Date","Description","Charge","Receipt / credit","Running balance"].map(h => <th className="border-b p-2" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r => { running += r.debit - r.credit; return <tr key={r.id}><td className="border-b p-2">{r.date}</td><td className="border-b p-2">{r.label}</td><td className="border-b p-2">{r.debit ? formatMoney(r.debit) : "—"}</td><td className="border-b p-2">{r.credit ? formatMoney(r.credit) : "—"}</td><td className="border-b p-2">{formatMoney(running)}</td></tr>; })}</tbody></table><p className="font-bold">Current net balance: {formatMoney(b.net)}. Negative means paid ahead, including allocations to future charges.</p><p>Unpaid overdue charges: {formatMoney(b.overdue)} · Unallocated credit: {formatMoney(b.credit)}.</p><p>Future charges and historic pre-cutover entries are excluded from this statement. The confirmed opening balance carries the agreed position forward.</p></main>;
}
