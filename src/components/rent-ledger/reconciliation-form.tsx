"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LedgerAccount } from "@/lib/rent-ledger/types";
import { normaliseReconciliation, currentRentStart, type ReconcileInput } from "@/lib/rent-ledger/reconciliation-input";
import { RentFieldError } from "@/lib/rent-ledger/errors";
import { previewCalendarReconciliation, saveCalendarReconciliation } from "@/lib/rent-ledger/reconcile-actions";
import { today } from "@/lib/rent-ledger/engine";
import { formatMoney } from "@/lib/money";
import { RentCalendar } from "./calendar";
import { card, field, button } from "./views";
type Preview=Extract<Awaited<ReturnType<typeof previewCalendarReconciliation>>,{ok:true}>["value"];
export function CalendarReconciliationForm({account:a,basePath}:{account:LedgerAccount;basePath:string}) {
  const draft=a.state==="review", router=useRouter();
  const schedule=a.schedules.find(s=>s.kind==="rent"&&s.enabled);
  const rates=[...(schedule?.rates||[])].sort((x,y)=>x.effectiveDate.localeCompare(y.effectiveDate));
  const frequency=schedule?.frequency==="monthly"?"monthly":"weekly";
  const [input,setInput]=useState<ReconcileInput>({accountId:a.id,version:a.version,requestId:"",first:a.approval?.firstCoverageDate||"",calculationFrom:"",lastPaymentDate:a.reconciliation?.lastPaymentDate||"",lastPaymentAmount:a.reconciliation?.lastPaymentAmountPence!==undefined?(a.reconciliation.lastPaymentAmountPence/100).toFixed(2):"",paidThrough:"",coverageFrom:"",opening:"",reason:"",setupMode:draft?"calculator":"manual",firstUnpaid:"",previousRent:rates.length>1?(rates.at(-2)!.amountPence/100).toFixed(2):"",newRent:rates.length?(rates.at(-1)!.amountPence/100).toFixed(2):"",effectiveDate:rates.at(-1)?.effectiveDate||currentRentStart(today(),frequency),frequency,calculationDate:today()});
  const [preview,setPreview]=useState<Preview>(), [confirmed,setConfirmed]=useState(false), [error,setError]=useState("");
  const [errors,setErrors]=useState<Record<string,string>>({}), [busy,setBusy]=useState(false), [month,setMonth]=useState(today().slice(0,7));
  function change(key:keyof ReconcileInput,value:string|boolean){setInput(i=>({...i,[key]:value,requestId:""}));setPreview(undefined);setConfirmed(false);setErrors({});setError("");}
  function failure(e:unknown){setError(e instanceof Error?e.message:"Unable to preview. Refresh and try again.");if(e instanceof RentFieldError)setErrors({[e.field]:e.message});}
  function entry(key:keyof ReconcileInput,label:string,type="text",hint?:string) {
    return <label className="block" key={key}>{label}<input id={`reconcile-${key}`} name={key} type={type} inputMode={type==="text"?"decimal":undefined} className={field} value={String(input[key]??"")} aria-invalid={!!errors[key]} aria-describedby={errors[key]?`reconcile-error-${key}`:undefined} onChange={e=>change(key,e.target.value)}/>{hint&&<span className="text-xs text-secondaryText">{hint}</span>}{errors[key]&&<span id={`reconcile-error-${key}`} className="block text-sm text-red-300">{errors[key]}</span>}</label>;
  }
  async function review(){
    setError("");setErrors({});setBusy(true);
    try {
      normaliseReconciliation(input,draft);
      const next={...input,requestId:input.requestId||crypto.randomUUID()};setInput(next);
      const result=await previewCalendarReconciliation(next);
      if(!result.ok){setError(result.error);setErrors(result.fieldErrors||{});}else setPreview(result.value);
    }catch(e){failure(e);}finally{setBusy(false);}
  }
  async function save(){
    setError("");setErrors({});setBusy(true);
    try {
      if(!confirmed)throw new RentFieldError("confirmed","Tick the confirmation after reviewing the balance.");
      const result=await saveCalendarReconciliation({...input,confirmed});
      if(!result.ok){setError(result.error);setErrors(result.fieldErrors||{});}else{setPreview(undefined);router.refresh();}
    }catch(e){failure(e);}finally{setBusy(false);}
  }
  const manual=input.setupMode==="manual";
  return <section className={card} id="reconciliation"><h2 className="text-2xl font-black">{draft?"Set up the starting rent balance":"Correct the confirmed balance"}</h2>
    <p>{draft?"Use your rent book to calculate what is owed, or enter its opening balance directly. Review the result before saving.":"Existing charges and payments stay in place. Any balance correction is saved as an audited adjustment."}</p>
    <fieldset disabled={busy} className="space-y-4">
      {draft&&<><div className="flex flex-wrap gap-4"><label><input type="radio" name="setupMode" checked={!manual} onChange={()=>change("setupMode","calculator")}/> Calculate from first unpaid date</label><label><input type="radio" name="setupMode" checked={manual} onChange={()=>change("setupMode","manual")}/> Enter balance from my book</label></div>
        <p className="text-sm">Calculation date: <b>{input.calculationDate}</b>. Charges due on this date are included.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>Frequency<select name="frequency" className={field} value={input.frequency} onChange={e=>change("frequency",e.target.value)}><option value="weekly">Weekly — Monday in advance</option><option value="monthly">Calendar monthly — 1st in advance</option></select>{errors.frequency&&<span className="text-red-300">{errors.frequency}</span>}</label>
          {!manual&&entry("firstUnpaid","First unpaid rent date","date",input.frequency==="weekly"?"Select the Monday when the first unpaid week starts.":"Select the 1st of the first unpaid month.")}
          {(!manual || !!input.effectiveDate && input.effectiveDate>currentRentStart(input.calculationDate!,input.frequency!))&&entry("previousRent","Previous rent (£ per cycle)")}
          {entry("newRent","New rent (£ per cycle)")}
          {entry("effectiveDate","New rate effective date","date","Earlier days keep the previous rate. A change within a period is prorated by day.")}
        </div>
        {!manual&&<p className="text-sm">“First unpaid” starts the debt. Rent paid through is the day before it. Last payment details do not change this calculation.</p>}
      </>}
      {manual?entry("opening",draft?"Opening arrears / credit (£)":"Confirmed balance today (£)","text",draft?"Balance through the day before the current rent period. Positive = owed; negative = credit. Current rent is added separately.":"Positive = owed; negative = credit. Includes existing rent and services."):<details><summary className="cursor-pointer">Override the calculated opening balance (optional)</summary><div className="mt-3">{entry("opening","Manual opening arrears / credit (£)","text","Leave blank to use the calculation. Positive = owed; negative = credit.")}</div></details>}
      <label className="block">{manual||input.opening?"Source / override reason":"Notes (optional)"}<textarea name="reason" className={field} rows={2} value={input.reason} aria-invalid={!!errors.reason} onChange={e=>change("reason",e.target.value)} placeholder="For example: confirmed balance from the rent book"/>{errors.reason&&<span className="block text-red-300">{errors.reason}</span>}</label>
      <details><summary className="cursor-pointer">Last payment details (optional — evidence only)</summary><p className="my-3 text-sm">Already reflected in your book’s first unpaid date or balance. These details are never deducted automatically and do not create a receipt.</p><div className="grid gap-4 sm:grid-cols-2">{entry("lastPaymentDate","Last payment date","date")}{entry("lastPaymentAmount","Last payment amount (£)")}</div></details>
      <details><summary className="cursor-pointer">Confirmed paid coverage / verified historical receipts (optional)</summary><div className="mt-3 space-y-3">
        {(manual||!draft)&&entry("paidThrough","Rent paid through (optional)","date","Only enter a date supported by your book. It is not the last payment date.")}
        {entry("coverageFrom","Earliest confirmed paid date (optional)","date","Only needed to colour earlier paid days green. Leave blank if unknown.")}
        {draft&&!manual&&<label className="block text-sm"><input type="checkbox" checked={!!input.deductKnownPayments} onChange={e=>change("deductKnownPayments",e.target.checked)}/> Deduct the receipts listed in the preview. I verified they are separate and are NOT already reflected in the first unpaid date or opening balance.</label>}
      </div></details>
      <button disabled={busy} className={button} onClick={review}>{busy?"Working…":"Preview balance and calendar"}</button>
    </fieldset>
    {preview&&<div className="space-y-4 rounded-xl border border-amber-500/40 p-4"><h3 className="text-xl font-black">Review before saving</h3>
      {draft?<><div className="grid gap-3 sm:grid-cols-3"><div><p>Historical opening {preview.account.reconciliation!.openingPence<0?"credit":"arrears"}</p><b>{formatMoney(Math.abs(preview.account.reconciliation!.openingPence))}</b><p className="text-xs">Through {preview.calculation.asOf}</p></div><div><p>Current rent period charge</p><b>{formatMoney(preview.calculation.currentCharges.filter(c=>c.category==="rent").reduce((n,c)=>n+c.amountPence,0))}</b>{preview.calculation.currentCharges.filter(c=>c.category==="rent").map(c=><p className="text-xs" key={c.id}>{c.periodStart} to {c.periodEnd} · due {c.dueDate}</p>)}</div><div><p>{preview.balances.net<0?"Total credit":"Total owed"}</p><b>{formatMoney(Math.abs(preview.balances.net))}</b><p className="text-xs">On {preview.calculation.calculationDate}</p></div></div>
        {preview.balances.services>0&&<p>Services are separate: {formatMoney(preview.balances.services)}, included in the account total.</p>}
        {preview.calculation.nextDueDate&&<p>Next rent charge: <b>{preview.calculation.nextDueDate}</b>.</p>}
      </>:<p>Confirmed balance today: {formatMoney(preview.balances.net)}.</p>}
      <p>Rent paid through: <b>{preview.account.reconciliation?.paidThrough||"Not confirmed"}</b>. {preview.account.reconciliation?.paidThrough&&!preview.account.reconciliation.coverageFrom&&"Earlier calendar days remain unknown unless you confirm a coverage start."}</p>
      <p className="text-sm">{preview.calculation.warning}</p>
      {preview.calculation.calculatedPence!==undefined&&input.opening&&<p>Calculated historical balance: {formatMoney(preview.calculation.calculatedPence)}. Your confirmed balance: {formatMoney(preview.account.reconciliation!.openingPence)}.</p>}
      <details><summary className="cursor-pointer font-semibold">How this was calculated</summary><div className="mt-3 space-y-2">{!preview.calculation.lines.length&&<p>No historical unpaid rent periods added.</p>}{preview.calculation.lines.map(c=><div key={c.id}><p>{c.periodStart||c.dueDate} to {c.periodEnd||c.dueDate}: {formatMoney(c.amountPence)}</p>{c.calculation&&c.calculation.length>1&&c.calculation.map(x=><p className="text-xs" key={x.from}>{x.from} to {x.to}: {formatMoney(x.ratePence)} × {x.days}/{x.denominator} days</p>)}</div>)}{preview.calculation.knownPayments.map(p=><p key={p.id}>Verified receipt candidate: {p.date} · {formatMoney(p.amountPence)} · {input.deductKnownPayments?"deducted once":"not deducted"}</p>)}<p>Last payment evidence is not an extra payment. Historical charges replace the opening amount; only any difference is recorded as an adjustment.</p></div></details>
      <label className="block">Calendar month<input type="month" className={field} value={month} onChange={e=>setMonth(e.target.value)}/></label><RentCalendar account={preview.account} month={month} basePath={basePath} onMonthChange={setMonth}/>
      <label className="block"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I have checked the dates, rates and balance shown above.</label>{errors.confirmed&&<p className="text-red-300">{errors.confirmed}</p>}
      <button disabled={busy} className={button} onClick={save}>{busy?"Saving…":draft?"Confirm balance and activate rent":"Save balance correction"}</button>
    </div>}
    {error&&<p role="alert" className="text-red-300">{error}</p>}
  </section>;
}
