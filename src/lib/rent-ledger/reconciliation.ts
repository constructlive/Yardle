import { randomUUID } from "node:crypto";
import { addDays, balances, chargeRemaining, date, daysBetween, money, projectCharges, today } from "./engine";
import { RentError } from "./errors";
import type { LedgerAccount, Charge } from "./types";

export type ReconcileInput = { accountId: string; version: number; requestId: string; first: string; calculationFrom: string; lastPaymentDate: string; lastPaymentAmount: string; paidThrough: string; coverageFrom: string; opening: string; reason: string; deductKnownPayments?: boolean; confirmed?: boolean };
export function calculateReconciliation(a: LedgerAccount, input: ReconcileInput) {
  const draft = a.state === "review"; const asOf = draft ? addDays(input.first,-1) : today();
  const from = input.calculationFrom || (input.paidThrough ? addDays(input.paidThrough,1) : input.first);
  date(from); date(input.first); if(daysBetween(from,asOf)>3660)throw new RentError("Limit a reconciliation to ten years.");
  if(input.lastPaymentDate){date(input.lastPaymentDate);if(input.lastPaymentDate>today())throw new RentError("Last payment date cannot be in the future.");}
  if(input.lastPaymentAmount&&!input.lastPaymentDate)throw new RentError("Enter the date for the last payment amount.");
  if(input.lastPaymentAmount&&money(input.lastPaymentAmount)<0)throw new RentError("Last payment amount cannot be negative.");
  if(input.paidThrough){date(input.paidThrough);date(input.coverageFrom);if(input.coverageFrom>input.paidThrough)throw new RentError("Confirmed coverage starts after the paid-through date.");if(draft&&input.paidThrough>=input.first)throw new RentError("For initial setup, paid-through must be before new coverage starts. Record advance payments after activation.");if(!draft&&input.paidThrough>today())throw new RentError("Reconcile through today; allocate advance payments using Record payment.");}
  if(!draft)return {asOf,from,available:true,calculatedPence:balances(a,asOf).net,lines:a.charges.filter(c=>!c.cancelled&&c.dueDate<=asOf),knownPayments:a.payments.filter(p=>!p.reversedAt&&p.receivedDate<=asOf).map(p=>({id:p.id,date:p.receivedDate,amountPence:p.amountPence})),warning:"Current account balance includes rent, services and opening entries. Last payment details are evidence only, not a new receipt."};
  if(input.first>today())throw new RentError("Initial new coverage cannot start in the future.");
  if(from>asOf)return {asOf,from,available:true,calculatedPence:0,lines:[] as Charge[],knownPayments:[] as {id:string;date:string;amountPence:number}[],warning:"No historical calculation interval. Enter and explain the agreed opening balance."};
  const schedules=a.schedules.filter(s=>s.kind==="rent"&&s.enabled&&s.startDate<=asOf&&(!s.endDate||s.endDate>=from));
  let cursor=from;
  for(const s of [...schedules].sort((x,y)=>x.startDate.localeCompare(y.startDate))){if(s.startDate>cursor)break;const end=s.endDate||asOf;if(end>=cursor)cursor=addDays(end,1);}
  const available=schedules.length>0&&cursor>asOf&&!schedules.some(s=>s.frequency==="manual"||!s.rates.some(r=>r.effectiveDate<=s.startDate));
  if(!available)return {asOf,from,available:false,calculatedPence:undefined,lines:[] as Charge[],knownPayments:[] as {id:string;date:string;amountPence:number}[],warning:"Historical schedule/rate evidence is incomplete. Today's rate is not used for earlier weeks. Enter a supported opening balance with a reason, or add the actual historical schedule and dated rates before previewing."};
  const shadow=structuredClone(a);shadow.schedules=schedules.map(s=>({...s,endDate:s.endDate&&s.endDate<asOf?s.endDate:asOf}));
  const lines=projectCharges(shadow,asOf,from).filter(c=>c.dueDate<=asOf);
  const snapshot=a.migration.snapshot as {payments?:{id:string;paymentDate:string;amountPence:number;reversedAt?:string}[]};
  const knownPayments=[...(snapshot.payments||[]).filter(p=>!p.reversedAt).map(p=>({id:p.id,date:p.paymentDate,amountPence:p.amountPence})),...a.payments.filter(p=>!p.reversedAt&&!p.legacyId).map(p=>({id:p.id,date:p.receivedDate,amountPence:p.amountPence}))].filter(p=>p.date>=from&&p.date<=asOf);
  const unique=[...new Map(knownPayments.map(p=>[p.id,p])).values()];
  return {asOf,from,available:true,calculatedPence:lines.reduce((n,c)=>n+c.amountPence,0)-(input.deductKnownPayments?unique.reduce((n,p)=>n+p.amountPence,0):0),lines,knownPayments:unique,warning:input.deductKnownPayments?"Listed historical receipts are deducted once on your explicit confirmation that they are not already reflected in paid-through. Entered last-payment details are not deducted again.":"Historical receipt allocations are unknown. Listed receipts are NOT deducted: they may already be reflected in paid-through. Review them and explicitly confirm deduction if appropriate. Entered last-payment details remain evidence only."};
}

export function applyReconciliation(a: LedgerAccount, input: ReconcileInput, actor: string) {
  if(a.reconciliationRequests?.includes(input.requestId)){
    const previous=a.audit.find(e=>e.type==="calendar_reconciliation"&&(e.detail as {input?:ReconcileInput}).input?.requestId===input.requestId)?.detail as {input:ReconcileInput}|undefined;
    const values=(i:ReconcileInput)=>JSON.stringify([i.accountId,i.first,i.calculationFrom,i.lastPaymentDate,i.lastPaymentAmount,i.paidThrough,i.coverageFrom,i.opening,i.reason,!!i.deductKnownPayments]);
    if(!previous||values(previous.input)!==values(input))throw new RentError("This reconciliation request was already saved with different values. Refresh and create a new preview.");
    return;
  }
  if(!/^[a-f0-9-]{36}$/.test(input.requestId))throw new RentError("Invalid reconciliation request.");
  if(a.version!==input.version)throw new RentError("Account changed. Refresh and review a new preview.");
  const calculation=calculateReconciliation(a,input);const opening=money(input.opening);const reason=input.reason.trim();
  if(!reason)throw new RentError("Record your evidence and a reason for any manual override.");
  const at=new Date().toISOString();const draft=a.state==="review";
  if(draft){
    if(!a.schedules.some(s=>s.enabled&&s.rates.some(r=>r.amountPence>0)))throw new RentError("Save the agreed rent schedule first.");
    a.approval={actor,at,firstCoverageDate:input.first,confirmedOpeningPence:opening,note:reason};a.state="active";
    // Reconstructed historic periods replace the lump-sum opening for this interval.
    // Originals remain archived. Prefixes cannot collide with new schedule period keys.
    if(calculation.available)for(const c of calculation.lines){const id=`reconciled:${c.id}`;if(!a.charges.some(x=>x.id===id))a.charges.push({...c,id,description:`Reconciled history: ${c.description}`});}
  }
  const adjustment=(amount:number,label:string)=>{
    const id=randomUUID();a.adjustments.push({id,accountId:a.id,category:"rent",amountPence:amount,date:calculation.asOf,reason:label,actor});
    if(amount>0)a.charges.push({id:`adjustment:${id}`,accountId:a.id,sourceId:"reconciliation",category:"opening",description:label,dueDate:calculation.asOf,amountPence:amount,coverageKnown:false});
    if(amount<0)a.payments.push({id:`reconciliation:${id}`,requestId:`reconciliation:${id}`,accountId:a.id,amountPence:-amount,receivedDate:calculation.asOf,method:"other",reference:label,allocations:[],recordedBy:actor,createdAt:at,legacyId:"reconciliation-credit"});
  };
  if(!draft&&input.paidThrough){
    // Only known complete live periods can be confirmed; do not prorate a partial payment into days.
    const crossing=a.charges.some(c=>c.category==="rent"&&!c.cancelled&&c.periodStart!<=input.paidThrough&&c.periodEnd!>input.paidThrough&&chargeRemaining(a,c)>0);
    if(crossing)throw new RentError("Paid-through falls inside an unpaid period. Allocate the payment to that period first, or confirm a complete period boundary.");
    const targets=a.charges.filter(c=>c.category==="rent"&&!c.cancelled&&c.periodEnd&&c.periodEnd<=input.paidThrough);
    let needed=targets.reduce((n,c)=>n+chargeRemaining(a,c),0);
    const credits=()=>a.payments.filter(p=>!p.reversedAt&&p.receivedDate<=calculation.asOf);
    const available=credits().reduce((n,p)=>n+p.amountPence-p.allocations.reduce((s,x)=>s+x.amountPence,0),0);
    if(needed>available)adjustment(-(needed-available),`Reconciliation coverage credit: ${reason}`);
    for(const c of targets)for(const p of credits()){const take=Math.min(chargeRemaining(a,c),p.amountPence-p.allocations.reduce((n,x)=>n+x.amountPence,0));if(take>0){const allocation=p.allocations.find(x=>x.chargeId===c.id);if(allocation)allocation.amountPence+=take;else p.allocations.push({chargeId:c.id,amountPence:take});}}
  }
  const delta=opening-balances(a,calculation.asOf).net;
  if(delta)adjustment(delta,`Reconciled balance: ${reason}`);
  // Apply adjustment credit only to reconstructed historical charges, retaining any excess as credit.
  if(draft)for(const c of a.charges.filter(c=>c.id.startsWith("reconciled:")).sort((x,y)=>x.dueDate.localeCompare(y.dueDate)))for(const p of a.payments.filter(p=>p.legacyId==="reconciliation-credit")){const take=Math.min(chargeRemaining(a,c),p.amountPence-p.allocations.reduce((n,x)=>n+x.amountPence,0));if(take>0)p.allocations.push({chargeId:c.id,amountPence:take});}
  a.reconciliation={lastPaymentDate:input.lastPaymentDate||undefined,lastPaymentAmountPence:input.lastPaymentAmount?money(input.lastPaymentAmount):undefined,coverageFrom:input.coverageFrom||undefined,paidThrough:input.paidThrough||undefined,asOf:calculation.asOf,openingPence:opening,calculatedPence:calculation.calculatedPence,reason,at,actor};
  (a.reconciliationRequests??=[]).push(input.requestId);
  a.audit.push({id:randomUUID(),at,actor,type:"calendar_reconciliation",detail:{input,calculation,adjustmentPence:delta,lastPaymentIsEvidenceOnly:true}});
}
