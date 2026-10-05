import { randomUUID } from "node:crypto";
import { addDays, balances, chargeRemaining, daysBetween, money, projectCharges, today } from "./engine";
import { normaliseReconciliation, reconciliationSchedule, nextRentStart, type ReconcileInput } from "./reconciliation-input";
export type { ReconcileInput } from "./reconciliation-input";
import { RentFieldError, RentError } from "./errors";
import type { LedgerAccount, Charge, Schedule } from "./types";

export type ReconciliationCalculation = {
  asOf: string; from: string; available: boolean; calculatedPence: number | undefined;
  lines: Charge[]; knownPayments: {id:string;date:string;amountPence:number}[]; warning: string;
  schedule?: Schedule; currentCharges: Charge[]; calculationDate: string; nextDueDate?: string;
};
function calculateExisting(a: LedgerAccount, raw: ReconcileInput) {
  const draft = a.state === "review"; const input = normaliseReconciliation(raw,draft);
  const asOf = draft ? addDays(input.first,-1) : today();
  const from = input.calculationFrom || (input.paidThrough ? addDays(input.paidThrough,1) : input.first);
  if(daysBetween(from,asOf)>3660)throw new RentFieldError("calculationFrom","Calculate historical arrears from: limit a reconciliation to ten years.");
  if(!draft)return {asOf,from,available:true,calculatedPence:balances(a,asOf).net,lines:a.charges.filter(c=>!c.cancelled&&c.dueDate<=asOf),knownPayments:a.payments.filter(p=>!p.reversedAt&&p.receivedDate<=asOf).map(p=>({id:p.id,date:p.receivedDate,amountPence:p.amountPence})),warning:"Current account balance includes rent, services and opening entries. Last payment details are evidence only, not a new receipt."};
  if(from>asOf)return {asOf,from,available:true,calculatedPence:0,lines:[] as Charge[],knownPayments:[] as {id:string;date:string;amountPence:number}[],warning:"There are no unpaid periods before the current rent period. Historical opening arrears are £0 unless you enter a manual override."};
  const schedules=a.schedules.filter(s=>s.kind==="rent"&&s.enabled&&s.startDate<=asOf&&(!s.endDate||s.endDate>=from));
  let cursor=from;
  for(const s of [...schedules].sort((x,y)=>x.startDate.localeCompare(y.startDate))){if(s.startDate>cursor)break;const end=s.endDate||asOf;if(end>=cursor)cursor=addDays(end,1);}
  const available=schedules.length>0&&cursor>asOf&&!schedules.some(s=>s.frequency==="manual"||!s.rates.some(r=>r.effectiveDate<=s.startDate));
  if(!available)return {asOf,from,available:false,calculatedPence:undefined,lines:[] as Charge[],knownPayments:[] as {id:string;date:string;amountPence:number}[],warning:"Historical schedule/rate evidence is incomplete. Today's rate is not used for earlier weeks. Enter a supported opening balance with a reason, or add the actual historical schedule and dated rates before previewing."};
  const shadow=structuredClone(a);shadow.schedules=schedules.map(s=>({...s,endDate:s.endDate&&s.endDate<asOf?s.endDate:asOf}));
  const lines=projectCharges(shadow,asOf,from).filter(c=>c.dueDate<=asOf);
  const snapshot=a.migration.snapshot as {payments?:{id:string;paymentDate:string;amountPence:number;reversedAt?:string}[]};
  const ledgerIdentities=new Set(a.payments.flatMap(p=>[p.id,...(p.legacyId?[p.legacyId]:[])]));
  const knownPayments=[...(snapshot.payments||[]).filter(p=>!p.reversedAt&&!ledgerIdentities.has(p.id)).map(p=>({id:p.id,date:p.paymentDate,amountPence:p.amountPence})),...a.payments.filter(p=>!p.reversedAt&&p.legacyId!=="reconciliation-credit"&&!p.legacyId?.startsWith("opening")).map(p=>({id:p.id,date:p.receivedDate,amountPence:p.amountPence-p.allocations.reduce((n,x)=>n+x.amountPence,0)}))].filter(p=>p.amountPence>0&&p.date>=from&&p.date<=asOf);
  const unique=[...new Map(knownPayments.map(p=>[p.id,p])).values()];
  return {asOf,from,available:true,calculatedPence:lines.reduce((n,c)=>n+c.amountPence,0)-(input.deductKnownPayments?unique.reduce((n,p)=>n+p.amountPence,0):0),lines,knownPayments:unique,warning:input.deductKnownPayments?"The separately verified receipts listed below are deducted once. Last payment details remain evidence only.":"The first unpaid date already reflects your rent book. Last payment details and any listed receipts are not deducted unless you explicitly verify the separate receipts."};
}

export function calculateReconciliation(a: LedgerAccount, raw: ReconcileInput): ReconciliationCalculation {
  const draft = a.state === "review", input = normaliseReconciliation(raw,draft);
  const calculationDate = input.calculationDate || today();
  let shadow = a, schedule: Schedule | undefined;
  if (draft && input.setupMode) {
    if (a.charges.some(c => c.category === "rent")) throw new RentFieldError("setupMode","This draft already contains rent charges. Its historical schedule cannot be replaced. Review those existing records first.");
    schedule = reconciliationSchedule(input);
    shadow = structuredClone(a);
    shadow.schedules = [...a.schedules.filter(s=>s.kind!=="rent"),schedule];
  }
  const calculation = draft && input.setupMode === "manual"
    ? {asOf:addDays(input.first,-1),from:input.first,available:false,calculatedPence:undefined,lines:[] as Charge[],knownPayments:[] as {id:string;date:string;amountPence:number}[],warning:"Your book’s opening balance is used directly. No historical schedule or last-payment deduction is required."}
    : calculateExisting(shadow,{...input,setupMode:undefined});
  const currentCharges = draft ? projectCharges(shadow,calculationDate,input.first).filter(c=>c.dueDate<=calculationDate) : [];
  return {...calculation,schedule,currentCharges,calculationDate,nextDueDate:schedule?nextRentStart(input.first,schedule.frequency as "weekly"|"monthly"):undefined};
}

export function applyReconciliation(a: LedgerAccount, raw: ReconcileInput, actor: string) {
  let input = raw;
  if(a.reconciliationRequests?.includes(input.requestId)){
    const previous=a.audit.find(e=>e.type==="calendar_reconciliation"&&(e.detail as {input?:ReconcileInput}).input?.requestId===input.requestId)?.detail as {input:ReconcileInput}|undefined;
    const values=(i:ReconcileInput)=>JSON.stringify([i.accountId,i.first,i.calculationFrom,i.lastPaymentDate,i.lastPaymentAmount,i.paidThrough,i.coverageFrom,i.opening,i.reason,!!i.deductKnownPayments,i.setupMode||"",i.firstUnpaid||"",i.previousRent||"",i.newRent||"",i.effectiveDate||"",i.frequency||"",i.calculationDate||""]);
    if(!previous||values(previous.input)!==values(input))throw new RentError("This reconciliation request was already saved with different values. Refresh and create a new preview.");
    return;
  }
  if(!/^[a-f0-9-]{36}$/.test(input.requestId))throw new RentError("Invalid reconciliation request.");
  if(a.version!==input.version)throw new RentError("Account changed. Refresh and review a new preview.");
  input = normaliseReconciliation(raw,a.state === "review");
  const calculation=calculateReconciliation(a,input);
  if (!input.opening && calculation.calculatedPence === undefined) throw new RentFieldError("opening","Opening arrears / credit: enter the balance from your book, or complete the historical calculator.");
  const opening=input.opening ? money(input.opening) : calculation.calculatedPence!;
  const override = input.opening !== "" && opening !== calculation.calculatedPence;
  const reason=input.reason.trim() || (input.setupMode && !override ? "Administrator confirmed the first unpaid date and effective-dated rent calculation." : "");
  if(!reason)throw new RentFieldError("reason","Evidence / override reason: say where the confirmed balance came from and explain any override.");
  const at=new Date().toISOString();const draft=a.state==="review";
  if(draft){
    if (calculation.schedule) {
      const previous = structuredClone(a.schedules.filter(s=>s.kind==="rent"));
      // Preserve old draft schedules in the audit; one replacement rent schedule per account.
      a.schedules = [...a.schedules.filter(s=>s.kind!=="rent"),calculation.schedule];
      a.audit.push({id:randomUUID(),at,actor,type:"reconciliation_schedule",detail:{before:previous,after:calculation.schedule}});
    }
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
    if(crossing)throw new RentFieldError("paidThrough","Rent paid through falls inside an unpaid period. Allocate the payment to that period first, or confirm a complete period boundary.");
    const targets=a.charges.filter(c=>c.category==="rent"&&!c.cancelled&&c.periodEnd&&c.periodEnd<=input.paidThrough);
    let needed=targets.reduce((n,c)=>n+chargeRemaining(a,c),0);
    const credits=()=>a.payments.filter(p=>!p.reversedAt&&p.receivedDate<=calculation.asOf);
    const available=credits().reduce((n,p)=>n+p.amountPence-p.allocations.reduce((s,x)=>s+x.amountPence,0),0);
    if(needed>available)adjustment(-(needed-available),`Reconciliation coverage credit: ${reason}`);
    for(const c of targets)for(const p of credits()){const take=Math.min(chargeRemaining(a,c),p.amountPence-p.allocations.reduce((n,x)=>n+x.amountPence,0));if(take>0){const allocation=p.allocations.find(x=>x.chargeId===c.id);if(allocation)allocation.amountPence+=take;else p.allocations.push({chargeId:c.id,amountPence:take});}}
  }
  const beforeAdjustment=balances(a,calculation.asOf);
  const delta=opening+(draft&&input.setupMode?beforeAdjustment.services:0)-beforeAdjustment.net;
  if(delta)adjustment(delta,`Reconciled balance: ${reason}`);
  // Apply adjustment credit only to reconstructed historical charges, retaining any excess as credit.
  if(draft)for(const c of a.charges.filter(c=>c.id.startsWith("reconciled:")).sort((x,y)=>x.dueDate.localeCompare(y.dueDate)))for(const p of a.payments.filter(p=>!p.reversedAt&&(p.legacyId==="reconciliation-credit" || input.deductKnownPayments&&calculation.knownPayments.some(known=>known.id===p.id)))){const take=Math.min(chargeRemaining(a,c),p.amountPence-p.allocations.reduce((n,x)=>n+x.amountPence,0));if(take>0)p.allocations.push({chargeId:c.id,amountPence:take});}
  a.reconciliation={lastPaymentDate:input.lastPaymentDate||(!draft?a.reconciliation?.lastPaymentDate:undefined),lastPaymentAmountPence:input.lastPaymentAmount?money(input.lastPaymentAmount):(!draft?a.reconciliation?.lastPaymentAmountPence:undefined),coverageFrom:input.coverageFrom||(!draft?a.reconciliation?.coverageFrom:undefined),paidThrough:input.paidThrough||(!draft?a.reconciliation?.paidThrough:undefined),asOf:calculation.asOf,openingPence:opening,calculatedPence:calculation.calculatedPence,reason,at,actor};
  (a.reconciliationRequests??=[]).push(input.requestId);
  a.audit.push({id:randomUUID(),at,actor,type:"calendar_reconciliation",detail:{input:raw,normalisedInput:input,calculation,adjustmentPence:delta,manualOverride:override,lastPaymentIsEvidenceOnly:true}});
}
