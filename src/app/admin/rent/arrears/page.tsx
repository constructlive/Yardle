import { PageHeader } from "@/components/ui";
import { AccountsTable } from "@/components/rent-ledger/views";
import { getLedgerAccounts } from "@/lib/rent-ledger/store";
import { balances } from "@/lib/rent-ledger/engine";
export const dynamic = "force-dynamic";
export default async function Arrears() { const accounts = (await getLedgerAccounts()).filter(a => balances(a).overdue > 0); return <div className="space-y-4"><PageHeader title="Overdue rent accounts" eyebrow="Rent Management" /><p>Charges with a due date before today and an unpaid allocation balance. Future charges are excluded. Apply available account credit to settle specific charges.</p><AccountsTable accounts={accounts} /></div>; }
