"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUnitRent } from "@/lib/rent-ledger/ui-actions";
import { button, field } from "./views";
export type UnitRentChoice={id:string;label:string;sourceVersion?:number;separateFromDraft?:boolean};
export function UnitRentSetup({parentId,version,units,startDate}:{parentId:string;version:number;units:UnitRentChoice[];startDate:string}){
  const router=useRouter();const [unitId,setUnitId]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [requestId,setRequestId]=useState("");const selected=units.find(u=>u.id===unitId);
  return <form className="space-y-3 rounded-xl border border-slateLine p-4" onChange={()=>{setRequestId("");setError("");}} onSubmit={async e=>{e.preventDefault();const data=new FormData(e.currentTarget);const key=requestId||crypto.randomUUID();setRequestId(key);data.set("requestId",key);setBusy(true);setError("");try{const result=await createUnitRent(data);if(!result.ok)setError(result.error);else router.refresh();}catch{setError("Unable to complete setup. Refresh to check whether it saved before retrying.");}finally{setBusy(false);}}}>
    <input type="hidden" name="parentId" value={parentId}/><input type="hidden" name="version" value={version}/>{selected?.sourceVersion!==undefined&&<input type="hidden" name="sourceVersion" value={selected.sourceVersion}/>}
    <p>Each unit gets its own rent balance, payments and calendar.</p>
    <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2"><label>Unit<select name="unitId" className={field} value={unitId} onChange={e=>setUnitId(e.target.value)} required><option value="">Choose a unit</option>{units.map(u=><option key={u.id} value={u.id}>{u.label}</option>)}</select></label><label>Rent amount (£)<input className={field} name="amount" inputMode="decimal" required/></label><label>Rent frequency<select name="frequency" className={field}><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label><label>Rate and rent start date<input type="date" className={field} name="startDate" defaultValue={startDate} required/></label></fieldset>
    <p className="text-xs text-secondaryText">Rent is due in advance on the selected start weekday/date, with daily calculation for partial periods. You can change these rules in the account before activation.</p>
    {selected?.separateFromDraft&&<label className="block text-sm"><input type="checkbox" name="confirmMove" required/> Give this unit its own account, separate from the existing draft. Old history and the remaining draft schedules stay on the original account for review.</label>}
    <p className="text-sm">Next: open this unit’s account and confirm its opening arrears or credit. Automatic rent starts only after that confirmation.</p>
    <button className={button} disabled={busy||!units.length}>{busy?"Saving…":"Save unit rent"}</button>{!units.length&&<p>No available units. Confirmed unit accounts are listed above; use their account page to change rent.</p>}{error&&<p role="alert" className="text-red-300">{error}</p>}
  </form>;
}
