import { QuerySummary } from "@/components/tenant-portal/query-summary";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { AccountsTable, button, card } from "@/components/rent-ledger/views";
import { getLedgerAccounts } from "@/lib/rent-ledger/store";
import { balances, chargesWithProjections, today } from "@/lib/rent-ledger/engine";
import { formatMoney } from "@/lib/money";
export const dynamic = "force-dynamic";
export default async function RentDashboard() {
  const accounts = await getLedgerAccounts(); const active = accounts.filter(a => a.state !== "review");
  const totals = active.map(a => balances(a, today(), chargesWithProjections(a)));
  return <div className="space-y-5"><PageHeader title="Rent accounts" eyebrow="Rent Management" action={<Link className={button} href="/admin/rent/accounts">Manage accounts</Link>} /><p>Approved accounts update automatically. Accounts awaiting reconciliation do not generate charges.</p>{accounts.some(a => a.state === "review") && <div className={`${card} border-amber-500/40`}><b>{accounts.filter(a => a.state === "review").length} accounts need opening balances and administrator sign-off.</b><p>Enter the amount owed or credit brought forward, then the agreed rate starting today. Preview each account before activation.</p></div>}<div className="grid gap-3 md:grid-cols-4">{([['Current outstanding','outstanding'],['Unpaid overdue charges','overdue'],['Upcoming · 90 days','upcoming'],['Unallocated credit','credit']] as const).map(([label, key]) => <div className={card} key={key}><p>{label}</p><strong className="text-2xl">{formatMoney(totals.reduce((n, b) => n + b[key], 0))}</strong></div>)}</div><QuerySummary /><AccountsTable accounts={accounts} /><p className="text-sm text-mutedText">Rent and services belong to the account. Electricity retains its separate unit balances. Credit is not automatically allocated to overdue charges.</p></div>;
}
