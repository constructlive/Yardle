import { PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/rent-ledger/forms";
import { AccountsTable, button, card, field } from "@/components/rent-ledger/views";
import { saveAccountDetails } from "@/lib/rent-ledger/ui-actions";
import { getLedgerAccounts } from "@/lib/rent-ledger/store";
export const dynamic = "force-dynamic";
export default async function Accounts() {
  const accounts = await getLedgerAccounts();
  return <div className="space-y-5"><PageHeader title="Rent accounts" eyebrow="Rent Management" /><AccountsTable accounts={accounts} /><ActionForm action={saveAccountDetails} className={card}><h2 className="text-xl font-black">New rent account</h2><div className="grid gap-3 md:grid-cols-2">{[["name","Account name"],["contactName","Contact name"],["mobile","Mobile"],["email","Email"]].map(([name,label]) => <label key={name}>{label}<input className={field} name={name} required={name === "name"} /></label>)}</div><button className={button}>Create account for reconciliation</button></ActionForm></div>;
}
