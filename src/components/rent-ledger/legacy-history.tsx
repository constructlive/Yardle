import type { LedgerAccount } from "@/lib/rent-ledger/types";
import type { RentAccount, RentCharge, RentPayment, RentSetting, Unit } from "@/lib/types";
import { formatMoney } from "@/lib/money";
export function LegacyHistory({ account }: { account: LedgerAccount }) {
  const old = account.migration.snapshot as { account?: RentAccount; units?: Unit[]; settings?: RentSetting[]; charges?: RentCharge[]; payments?: RentPayment[] };
  const unitName = (id: string) => old.units?.find(u => u.id === id)?.unitReference || "Former unit";
  return <div className="space-y-4 text-sm"><p>These original records are preserved for reconciliation. They are excluded from the new balance; the approved brought-forward entry replaces their net position.</p>
    {old.account && <p>Original account opening balance: {formatMoney(old.account.openingBalancePence)}</p>}
    {old.settings?.map(s => <p key={s.id}>Unit {unitName(s.unitId)}: original opening balance {formatMoney(s.openingBalancePence)}, rate {formatMoney(s.amountPence)}, {s.frequency.replaceAll("_", " ")}, from {s.startDate}.</p>)}
    <h3 className="font-bold">Original rent charges</h3><div className="overflow-auto"><table className="w-full text-left"><thead><tr><th>Unit</th><th>Due date</th><th>Amount</th><th>Status / notes</th></tr></thead><tbody>{old.charges?.map(c => <tr className="border-t border-slateLine" key={c.id}><td className="p-2">{unitName(c.unitId)}</td><td>{c.dueDate}</td><td>{formatMoney(c.amountPence)}</td><td>{c.status} · {c.notes}</td></tr>)}</tbody></table></div>
    <h3 className="font-bold">Original payments</h3><div className="overflow-auto"><table className="w-full text-left"><thead><tr><th>Unit</th><th>Received</th><th>Amount</th><th>Method / notes</th><th>Status</th></tr></thead><tbody>{old.payments?.map(p => <tr className="border-t border-slateLine" key={p.id}><td className="p-2">{unitName(p.unitId)}</td><td>{p.paymentDate}</td><td>{formatMoney(p.amountPence)}</td><td>{p.paymentMethod.replaceAll("_", " ")} · {p.notes}</td><td>{p.reversedAt ? `Reversed: ${p.reversalReason}` : "Recorded"}</td></tr>)}</tbody></table></div>
  </div>;
}
