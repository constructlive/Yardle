import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/rent-ledger/forms";
import { button, card, field } from "@/components/rent-ledger/views";
import { UnitAssignment } from "@/components/rent-ledger/unit-assignment";
import { saveAccountDetails } from "@/lib/rent-ledger/ui-actions";
import { getLedgerAccounts } from "@/lib/rent-ledger/store";
import { getAppData } from "@/lib/data";
import { accountPath } from "@/lib/rent-ledger/links";
export const dynamic = "force-dynamic";
export default async function Accounts() {
  const accounts = (await getLedgerAccounts()).sort((a,b)=>a.name.localeCompare(b.name));
  const data = await getAppData();
  return <div className="space-y-5"><PageHeader title="Rent tenants" eyebrow="Rent Management"/>
    <p>Add the tenant’s name, then assign their units yourself. Electricity bill access is set up separately inside each account.</p>
    <ActionForm action={saveAccountDetails} className={card}><h2 className="text-xl font-black">Add tenant</h2><label className="block">Tenant name<input className={field} name="name" required/></label><details><summary className="cursor-pointer">Contact details (optional)</summary><div className="mt-3 grid gap-3 md:grid-cols-3">{[["contactName","Contact name"],["mobile","Mobile"],["email","Email"]].map(([name,label])=><label key={name}>{label}<input className={field} name={name}/></label>)}</div></details><button className={button}>Add tenant</button></ActionForm>
    <section className="divide-y divide-slateLine overflow-hidden rounded-2xl border border-slateLine bg-card" aria-label="Tenant list">{accounts.map(account=><article key={account.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><Link className="text-lg font-bold" href={accountPath(account.id)}>{account.name}</Link><p className="text-sm text-secondaryText">{account.unitIds.length?account.unitIds.map(id=>"Unit "+(data.units.find(u=>u.id===id)?.unitReference||"unknown")).join(", "):"No units assigned"}</p></div><Link className="text-sm font-semibold text-amber-200 underline" href={accountPath(account.id)}>Open rent account</Link></div><details className="mt-3"><summary className="cursor-pointer font-semibold text-amber-200">{account.unitIds.length?"Change assigned units":"Assign units"}</summary><div className="mt-4"><UnitAssignment account={account} accounts={accounts} units={data.units}/></div></details></article>)}{!accounts.length&&<p className="p-5 text-secondaryText">Add your first tenant above.</p>}</section>
  </div>;
}
