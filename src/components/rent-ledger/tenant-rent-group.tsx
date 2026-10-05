import { ActionForm } from "./forms";
import { button, field } from "./views";
import { linkExistingRentAccount } from "@/lib/rent-ledger/ui-actions";
import Link from "next/link";
import type { LedgerAccount } from "@/lib/rent-ledger/types";
import type { Unit } from "@/lib/types";
import { tenantGroupId, canSetUpUnitRent } from "@/lib/rent-ledger/unit-accounts";
import { balances, today } from "@/lib/rent-ledger/engine";
import { formatMoney } from "@/lib/money";
import { accountPath } from "@/lib/rent-ledger/links";
import { UnitRentSetup } from "./unit-rent-setup";
import { UnitAssignment } from "./unit-assignment";

export function TenantRentGroup({parent,accounts,units}:{parent:LedgerAccount;accounts:LedgerAccount[];units:Unit[]}){
  const members=accounts.filter(a=>tenantGroupId(a)===parent.id);
  const existing=accounts.filter(a=>a.id!==parent.id&&tenantGroupId(a)===a.id&&!accounts.some(other=>other.id!==a.id&&tenantGroupId(other)===a.id));
  const choices=units.flatMap(unit=>{
    const owners=accounts.filter(a=>a.unitIds.includes(unit.id));
    if(owners.length>1)return [];
    const owner=owners[0];
    if(owner&&(tenantGroupId(owner)!==parent.id||!canSetUpUnitRent(owner)))return [];
    return [{id:unit.id,label:`Unit ${unit.unitReference}${owner?.unitIds.length===1?" · edit draft rent":""}`,sourceVersion:owner?.version,separateFromDraft:!!owner&&owner.unitIds.length>1}];
  });
  return <article className="space-y-4 p-5"><h2 className="text-xl font-bold">{parent.name}</h2>
    <div className="space-y-2">{members.map(account=>{
      const balance=balances(account);const label=account.unitIds.length?account.unitIds.map(id=>"Unit "+(units.find(u=>u.id===id)?.unitReference||"unknown")).join(" + "):"No unit assigned";
      const rates=account.schedules.filter(s=>s.kind==="rent"&&s.enabled&&(!s.endDate||s.endDate>=today())).map(s=>{const dated=[...s.rates].sort((x,y)=>x.effectiveDate.localeCompare(y.effectiveDate));const rate=dated.filter(r=>r.effectiveDate<=today()).at(-1)||dated[0];return rate?`${formatMoney(rate.amountPence)} / ${s.frequency==="weekly"?"week":s.frequency==="monthly"?"month":"manual period"}${rate.effectiveDate>today()?" from "+rate.effectiveDate:""}`:"Rate not entered";});
      return <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slateLine p-3"><div><p className="font-semibold">{label}{account.unitIds.length>1&&<span className="ml-2 text-xs text-amber-200">Existing combined balance</span>}</p><p className="text-sm">{rates.length?`${account.state==="review"?"Draft rent":"Rent"}: ${rates.join(" + ")}`:"Rent not entered"}</p><p className="text-sm text-secondaryText">{account.state==="review"?"Opening balance awaiting confirmation":`Outstanding ${formatMoney(balance.outstanding)} · Credit ${formatMoney(balance.credit)}`}</p></div><Link href={accountPath(account.id)} className="font-semibold text-amber-200 underline">{account.state==="review"&&account.unitIds.length?"Confirm opening balance":"Open rent account"}</Link></div>;
    })}</div>
    <details><summary className="cursor-pointer font-semibold text-amber-200">Set up rent for a unit</summary><div className="mt-3"><UnitRentSetup key={members.map(a=>a.id+":"+a.version).join("|")} parentId={parent.id} version={parent.version} units={choices} startDate={today()}/></div></details>
    {existing.length>0&&<details><summary className="cursor-pointer font-semibold text-amber-200">Link an existing rent account</summary><ActionForm key={parent.version} action={linkExistingRentAccount} className="mt-3 space-y-3 rounded-xl border border-slateLine p-4"><input type="hidden" name="parentId" value={parent.id}/><input type="hidden" name="version" value={parent.version}/><label className="block">Existing rent account<select name="accountToLink" className={field} required defaultValue=""><option value="">Choose an account</option>{existing.map(a=><option key={a.id} value={JSON.stringify([a.id,a.version])}>{a.name} · {a.unitIds.map(id=>"Unit "+(units.find(u=>u.id===id)?.unitReference||"unknown")).join(" + ")||"No unit assigned"}</option>)}</select></label><label className="block text-sm"><input type="checkbox" name="confirmed" required/> This account belongs to {parent.name}. Keep its balance and payment history separate.</label><p className="text-xs text-secondaryText">This groups the accounts in the admin list. It does not transfer money, change units or expand private portal access.</p><button className={button}>Link rent account</button></ActionForm></details>}
    <details><summary className="cursor-pointer text-sm text-secondaryText">Existing combined account / change unit assignments</summary><p className="my-3 text-sm">Use this only to keep several units on one balance, or correct an existing assignment. For separate balances, use “Set up rent for a unit”. Confirmed balances and history are never divided automatically.</p>{members.map(account=><details key={account.id} className="my-2"><summary className="cursor-pointer">{account.name}</summary><UnitAssignment account={account} accounts={accounts} units={units}/></details>)}</details>
  </article>;
}
