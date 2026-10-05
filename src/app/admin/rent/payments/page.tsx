import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { PaymentHistory, card } from "@/components/rent-ledger/views";
import { getLedgerAccounts } from "@/lib/rent-ledger/store";
export const dynamic = "force-dynamic";
export default async function Payments() { const accounts = await getLedgerAccounts(); return <div className="space-y-5"><PageHeader title="Rent payments" eyebrow="Rent Management" /><p>Select an account to record a payment, review allocations or apply credit.</p>{accounts.map(a => <section className={card} key={a.id}><Link className="text-xl font-black text-amber-200" href={`/admin/rent/accounts/${encodeURIComponent(a.id)}`}>{a.name}</Link>{a.state !== "review" && <Link className="ml-4 underline" href={`/admin/rent/accounts/${encodeURIComponent(a.id)}/payment`}>Record payment</Link>}<PaymentHistory account={a} /></section>)}</div>; }
