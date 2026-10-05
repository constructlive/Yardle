import type { LedgerAccount } from "@/lib/rent-ledger/types";
import type { AppData } from "@/lib/data";
import { savePortalAccess, linkElectricityAccess } from "@/lib/tenant-portal/actions";
import { scopeIsCurrent, grantIsCurrent } from "@/lib/tenant-portal/policy";
import { ActionForm } from "@/components/rent-ledger/forms";
import { AccountFields, card, button } from "@/components/rent-ledger/views";
import { getAppBaseUrl } from "@/lib/secure-link";
import { formatMoney } from "@/lib/money";
import { CopyPortalLink } from "./copy-link";

export function PortalAccessPanel({ account:a, data }: { account: LedgerAccount; data: AppData }) {
  const current=a.portalEnabled&&scopeIsCurrent(a,data.units);
  return <section className={card}><h2 className="text-xl font-black">Tenant portal access</h2><p>Anyone holding or receiving a forwarded link can view this account and submit queries. Confirm the payer and every linked unit before enabling access. Replacing access revokes all existing portal entry links; electricity-only bill views remain available.</p>
    <p className="font-bold">{current?"Enabled for confirmed tenancy":a.portalEnabled?"Blocked: tenancy changed; confirm the new relationship":"Disabled"}</p>
    <ActionForm action={savePortalAccess}><AccountFields account={a}/><label className="block"><input type="checkbox" name="enabled" defaultChecked={a.portalEnabled}/> Enable private account access</label><label className="block"><input type="checkbox" name="regenerate"/> Replace portal link and revoke bill-to-portal links</label><label className="block"><input type="checkbox" name="confirmed"/> I confirm this payer, the current tenancy and all linked units, and understand that forwarded links grant account access.</label><button className={button}>Save portal access</button></ActionForm>
    {current&&a.portalToken&&<CopyPortalLink url={`${getAppBaseUrl()}/account/${a.portalToken}`}/>}
    {a.unitIds.map(id=>{const u=data.units.find(u=>u.id===id);if(!u)return null;const g=a.portalGrants?.find(g=>grantIsCurrent(g,u));return <ActionForm key={`${id}-${a.version}`} action={linkElectricityAccess} className="space-y-3 rounded-xl border border-slateLine p-4"><AccountFields account={a}/><input type="hidden" name="unitId" value={id}/><h3 className="font-bold">Link Unit {u.unitReference} electricity · {u.tenantName}</h3><p>Electricity balance: {formatMoney(u.currentBalancePence)}. {g?"Bill link currently authorised.":"No authorised bill-to-account link."}</p><p>Select only existing bills belonging to this tenant. Later bills follow this tenancy while its identity and access token remain unchanged.</p>{data.bills.filter(b=>b.unitId===id&&b.issuedAt).map(b=><label className="block" key={b.id}><input type="checkbox" name="billIds" value={b.id} defaultChecked={g?.billIds.includes(b.id)}/> {data.billingPeriods.find(p=>p.id===b.billingPeriodId)?.name} · {formatMoney(b.roundedTotalPence)}</label>)}<label className="block"><input name="confirmed" type="checkbox" required/> I confirm this electricity tenant is the account payer and the balance and selected bills belong to them.</label><button className={button} disabled={!current}>Confirm electricity link and history</button></ActionForm>;})}
  </section>;
}
