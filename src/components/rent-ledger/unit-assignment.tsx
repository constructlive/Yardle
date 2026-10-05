import type { LedgerAccount } from "@/lib/rent-ledger/types";
import type { Unit } from "@/lib/types";
import { saveAccountUnits } from "@/lib/rent-ledger/ui-actions";
import { ActionForm } from "./forms";
import { AccountFields, button } from "./views";

export function UnitAssignment({ account, accounts, units }: { account: LedgerAccount; accounts: LedgerAccount[]; units: Unit[] }) {
  return <ActionForm key={account.version} action={saveAccountUnits} className="space-y-3">
    <AccountFields account={account}/>
    <input type="hidden" name="reason" value="Administrator manually assigned units to this tenant account."/>
    <p className="text-sm text-secondaryText">Choose this tenant’s units. This does not link electricity bills or move any financial history.</p>
    <div className="grid max-h-80 gap-2 overflow-auto sm:grid-cols-2 lg:grid-cols-3">{units.map(unit => {
      const owner = accounts.find(other => other.id !== account.id && other.unitIds.includes(unit.id));
      return <label key={unit.id} className="flex items-start gap-2 rounded-lg border border-slateLine p-3"><input className="mt-1" type="checkbox" name="unitIds" value={unit.id} defaultChecked={account.unitIds.includes(unit.id)} disabled={!!owner}/><span>Unit {unit.unitReference}{owner&&<span className="block text-xs text-mutedText">Assigned to {owner.name}</span>}</span></label>;
    })}</div>
    <p className="text-xs text-mutedText">To move an assigned unit, remove it from its current tenant first. Balances and payments remain with their original account. Changing units requires portal access to be checked again.</p>
    <button className={button}>Save assigned units</button>
  </ActionForm>;
}
