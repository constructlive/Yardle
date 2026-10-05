import Link from "next/link";
import { readAccounts } from "@/lib/rent-ledger/store";
import { requireAdminSession } from "@/lib/session";
import { ChargeTable, PaymentHistory, card } from "@/components/rent-ledger/views";
import { LegacyHistory } from "@/components/rent-ledger/legacy-history";
import { balances } from "@/lib/rent-ledger/engine";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export default async function ArchivedAccounts() {
  await requireAdminSession();
  const accounts = (await readAccounts(true)).filter(a => a.archivedAt).sort((a,b) => a.name.localeCompare(b.name));
  return <div className="space-y-5"><Link href="/admin/rent/accounts" className="underline">Back to rent accounts</Link><h1 className="text-3xl font-black">Archived rent accounts</h1><p>Read-only history. Automatic charges and portal access are stopped. Outstanding balances have not been written off.</p>
    {!accounts.length && <p>No removed accounts.</p>}
    {accounts.map(account => { const balance = balances(account); return <details key={account.id} className={card}><summary className="cursor-pointer font-bold">{account.name} · Removed {account.archivedAt!.slice(0,10)}</summary>
      <p>Outstanding {formatMoney(balance.outstanding)} · Credit {formatMoney(balance.credit)}</p>
      <h2 className="font-bold">Charges</h2><ChargeTable account={account} future={false}/>
      <h2 className="font-bold">Payments and allocations</h2><PaymentHistory account={account}/>
      <h2 className="font-bold">Adjustments</h2>{account.adjustments.map(a => <p key={a.id}>{a.date} · {formatMoney(a.amountPence)} · {a.reason}</p>)}
      <LegacyHistory account={account}/>
      <details><summary className="cursor-pointer">Audit history</summary>{account.audit.map(e => <div key={e.id} className="my-3"><p>{e.at} · {e.actor} · {e.type}</p><pre className="overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(e.detail,null,2)}</pre></div>)}</details>
    </details>; })}
  </div>;
}
