import { notFound } from "next/navigation";
import Link from "next/link";
import { PaymentForm } from "@/components/rent-ledger/forms";
import { getLedgerAccounts } from "@/lib/rent-ledger/store";
export const dynamic = "force-dynamic";
export default async function RecordPayment({ params }: { params: { accountId: string } }) {
  const a = (await getLedgerAccounts()).find(a => a.id === params.accountId); if (!a) notFound();
  return <div className="space-y-4"><Link className="underline" href="/admin/rent/accounts">Choose another account</Link>{a.state === "review" ? <p>This account needs reconciliation and sign-off before live payments can be recorded.</p> : <PaymentForm key={a.id} account={a} />}</div>;
}
