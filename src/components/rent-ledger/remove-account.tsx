import { ActionForm } from "./forms";
import { AccountFields } from "./views";
import { removeRentAccount } from "@/lib/rent-ledger/ui-actions";
import { balances } from "@/lib/rent-ledger/engine";
import { formatMoney } from "@/lib/money";
import type { LedgerAccount } from "@/lib/rent-ledger/types";

export function RemoveAccount({ account }: { account: LedgerAccount }) {
  const balance = balances(account);
  return <details className="w-full text-sm"><summary className="cursor-pointer text-red-300">Remove rent account</summary>
    <ActionForm action={removeRentAccount} className="mt-3 space-y-3 rounded-xl border border-red-400/40 p-4">
      <AccountFields account={account}/>
      <p>Remove <strong>{account.name}</strong> from the current list? Automatic charges will stop and its portal links will be revoked. Its units can be assigned again.</p>
      <p>History stays in Archived accounts. Other rent accounts are kept.</p>
      {account.state !== "review" && <p>Outstanding: {formatMoney(balance.outstanding)} · Credit: {formatMoney(balance.credit)}. Removing the account does not settle or write off these amounts.</p>}
      <label className="block"><input type="checkbox" name="confirmed" required/> Remove this account and keep its history.</label>
      <button className="rounded-xl bg-red-900 px-4 py-2 font-bold text-white">Confirm removal</button>
    </ActionForm>
  </details>;
}
