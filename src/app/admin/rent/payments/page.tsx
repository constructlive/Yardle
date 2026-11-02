import { accountPath } from "@/lib/rent-ledger/links";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { PaymentHistory, card } from "@/components/rent-ledger/views";
import { PaymentFinder } from "@/components/rent-ledger/payment-finder";
import { getLedgerAccounts } from "@/lib/rent-ledger/store";
import { getAppData } from "@/lib/data";
export const dynamic = "force-dynamic";
export default async function Payments() {
  const accounts = await getLedgerAccounts();
  const data = await getAppData();
  const units = data.units.filter(unit => accounts.some(account => account.unitIds.includes(unit.id)))
    .sort((a, b) => a.unitReference.localeCompare(b.unitReference, "en-GB", { numeric: true }))
    .map(unit => ({ id: unit.id, label: "Unit " + unit.unitReference + " · " + accounts.filter(account => account.unitIds.includes(unit.id)).map(account => account.name).join(" / ") }));
  const entries = accounts.map(account => {
    const unitLabels = account.unitIds.map(id => { const unit = data.units.find(unit => unit.id === id); return unit ? "Unit " + unit.unitReference : "Unknown unit"; });
    return {
      id: account.id, unitIds: account.unitIds,
      search: [account.name, account.contactName, ...unitLabels].join(" ").toLocaleLowerCase(),
      content: <section className={card}>
        <div className="flex flex-wrap items-center gap-4"><Link className="text-xl font-black text-amber-200" href={accountPath(account.id)}>{account.name}</Link>{account.state !== "review" && <Link className="underline" href={accountPath(account.id) + "/payment"}>Record payment</Link>}</div>
        <p className="text-sm text-secondaryText">{unitLabels.join(" · ") || "No unit assigned"}{account.contactName && account.contactName !== account.name ? " · " + account.contactName : ""}</p>
        <PaymentHistory account={account} />
      </section>,
    };
  });
  return <div className="space-y-5"><PageHeader title="Rent payments" eyebrow="Rent Management" /><p>Select an account to record a payment, review allocations or apply credit.</p><PaymentFinder entries={entries} units={units} /></div>;
}
