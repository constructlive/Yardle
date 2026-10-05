import { PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/rent-ledger/forms";
import { button, card, field } from "@/components/rent-ledger/views";
import { TenantRentGroup } from "@/components/rent-ledger/tenant-rent-group";
import { tenantGroupId } from "@/lib/rent-ledger/unit-accounts";
import { saveAccountDetails } from "@/lib/rent-ledger/ui-actions";
import { getLedgerAccounts } from "@/lib/rent-ledger/store";
import { getAppData } from "@/lib/data";

export const dynamic = "force-dynamic";
export default async function Accounts() {
  const accounts = (await getLedgerAccounts()).sort((a,b)=>a.name.localeCompare(b.name));
  const data = await getAppData();
  return <div className="space-y-5"><PageHeader title="Rent tenants" eyebrow="Rent Management"/>
    <p>Add the tenant’s name, then set up rent for each unit. Each unit can have its own balance, payments and calendar. Electricity stays separate.</p>
    <ActionForm action={saveAccountDetails} className={card}><h2 className="text-xl font-black">Add tenant</h2><label className="block">Tenant name<input className={field} name="name" required/></label><details><summary className="cursor-pointer">Contact details (optional)</summary><div className="mt-3 grid gap-3 md:grid-cols-3">{[["contactName","Contact name"],["mobile","Mobile"],["email","Email"]].map(([name,label])=><label key={name}>{label}<input className={field} name={name}/></label>)}</div></details><button className={button}>Add tenant</button></ActionForm>
    <section className="divide-y divide-slateLine overflow-hidden rounded-2xl border border-slateLine bg-card" aria-label="Tenant list">{accounts.filter(a=>tenantGroupId(a)===a.id).map(parent=><TenantRentGroup key={parent.id} parent={parent} accounts={accounts} units={data.units}/>)}{!accounts.length&&<p className="p-5 text-secondaryText">Add your first tenant above.</p>}</section>
  </div>;
}
