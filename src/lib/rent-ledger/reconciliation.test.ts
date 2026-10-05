import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { applyReconciliation, calculateReconciliation, type ReconcileInput } from "./reconciliation";
import { normaliseReconciliation } from "./reconciliation-input";
import { calendarDay } from "./calendar";
import { balances, projectCharges, rentCoverage } from "./engine";
import type { LedgerAccount } from "./types";
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));});
function fixture():LedgerAccount{return{id:randomUUID(),name:"Rent",contactName:"",mobile:"",email:"",unitIds:[],state:"review",portalEnabled:false,version:0,schedules:[{id:"rent",kind:"rent",name:"Rent",frequency:"weekly",startDate:"2026-07-13",dueDay:1,timing:"advance",partialRule:"daily",enabled:true,rates:[{effectiveDate:"2026-07-13",amountPence:6500},{effectiveDate:"2026-10-05",amountPence:7000}]}],charges:[],payments:[],adjustments:[],audit:[],migration:{importedAt:"",originalOpeningPence:0,suggestedOpeningPence:0,legacyThroughDate:"",warnings:[],snapshot:{}}};}
function input(a:LedgerAccount):ReconcileInput{return{accountId:a.id,version:a.version,requestId:randomUUID(),first:"2026-10-05",calculationFrom:"2026-07-20",lastPaymentDate:"2026-07-19",lastPaymentAmount:"65",paidThrough:"2026-07-19",coverageFrom:"2026-07-13",opening:"715",reason:"11 unpaid weeks at agreed historic rate, current rate changes today"};}
describe("calendar reconciliation",()=>{
  it("calculates 11 old weeks at £65 and starts today's £70 separately",()=>{const a=fixture(),i=input(a);const calc=calculateReconciliation(a,i);expect(calc.calculatedPence).toBe(71500);expect(calc.lines).toHaveLength(11);expect(a.charges).toHaveLength(0);applyReconciliation(a,i,"admin");a.charges.push(...projectCharges(a));expect(balances(a).outstanding).toBe(78500);expect(a.payments).toHaveLength(0);expect(a.reconciliation?.lastPaymentAmountPence).toBe(6500);expect(calendarDay(a,"2026-07-15").status).toBe("paid");expect(calendarDay(a,"2026-07-21").status).toBe("overdue");expect(calendarDay(a,"2026-10-12").label).toBe("Future unpaid");expect(rentCoverage(a).through).toBe("2026-07-19");});
  it("deducts a known legacy payment once and shows a partial period",()=>{const a=fixture(),i=input(a);a.migration.snapshot={payments:[{id:"old",paymentDate:"2026-07-27",amountPence:3500}]};i.lastPaymentDate="2026-07-27";i.lastPaymentAmount="35";i.opening="680";expect(calculateReconciliation(a,i).calculatedPence).toBe(71500);i.deductKnownPayments=true;expect(calculateReconciliation(a,i).calculatedPence).toBe(68000);applyReconciliation(a,i,"admin");expect(balances(a).net).toBe(68000);expect(calendarDay(a,"2026-07-20").status).toBe("partial");expect(a.payments.every(p=>p.legacyId==="reconciliation-credit")).toBe(true);const count=[a.charges.length,a.payments.length,a.audit.length];applyReconciliation(a,i,"admin");expect([a.charges.length,a.payments.length,a.audit.length]).toEqual(count);});
  it("never applies today's rate to missing historical weeks",()=>{const a=fixture(),i=input(a);a.schedules[0].startDate="2026-10-05";a.schedules[0].rates=[{effectiveDate:"2026-10-05",amountPence:7000}];expect(calculateReconciliation(a,i).available).toBe(false);applyReconciliation(a,i,"admin");expect(balances(a).net).toBe(71500);expect(calendarDay(a,"2026-08-01").status).toBe("unknown");expect(calendarDay(a,"2026-07-15").label).toBe("Paid · reconciled");});
  it("requires an override reason and rejects stale previews",()=>{const a=fixture(),i=input(a);expect(()=>applyReconciliation(a,{...i,reason:""},"admin")).toThrow(/reason/);expect(()=>applyReconciliation(a,{...i,version:3},"admin")).toThrow(/changed/);});
  it("does not establish coverage from last payment date",()=>{const a=fixture(),i={...input(a),paidThrough:"",coverageFrom:"",lastPaymentDate:"2026-10-05",lastPaymentAmount:"1000"};applyReconciliation(a,i,"admin");expect(calendarDay(a,"2026-07-20").status).toBe("overdue");expect(rentCoverage(a).through).toBeUndefined();});
  it("uses actual rate segments in a partial period",()=>{const a=fixture(),i=input(a);a.schedules[0].rates.splice(1,0,{effectiveDate:"2026-09-30",amountPence:7000});const last=calculateReconciliation(a,i).lines.at(-1)!;expect(last.amountPence).toBe(6857);expect(last.calculation).toHaveLength(2);});
  it("reconciles live coverage through audited credits without rewriting cash receipts",()=>{const a=fixture(),i=input(a);i.opening="0";i.calculationFrom="2026-10-05";i.paidThrough="2026-10-04";applyReconciliation(a,i,"admin");a.charges.push(...projectCharges(a));vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));const cash={id:"cash",requestId:"cash",accountId:a.id,amountPence:2000,receivedDate:"2026-10-05",method:"cash",reference:"",allocations:[],recordedBy:"admin",createdAt:"2026-10-05"};a.payments.push(cash);const live={...i,requestId:randomUUID(),paidThrough:"2026-10-11",opening:"0"};applyReconciliation(a,live,"admin");expect(a.payments.filter(p=>!p.legacyId)).toHaveLength(1);expect(a.payments.find(p=>p.id==="cash")?.amountPence).toBe(2000);expect(calendarDay(a,"2026-10-06").status).toBe("paid");expect(balances(a).net).toBe(0);});
  it("shows partial allocations and respects reversals",()=>{const a=fixture(),i=input(a);i.opening="0";i.calculationFrom=i.first;applyReconciliation(a,i,"admin");a.charges.push(...projectCharges(a));const c=a.charges.find(c=>c.category==="rent")!;a.payments.push({id:"p",requestId:"p",accountId:a.id,amountPence:3500,receivedDate:"2026-10-05",method:"cash",reference:"",allocations:[{chargeId:c.id,amountPence:3500}],recordedBy:"admin",createdAt:""});expect(calendarDay(a,"2026-10-05").percent).toBe(50);expect(calendarDay(a,"2026-10-05").status).toBe("partial");a.payments[0].reversedAt="2026-10-05";expect(calendarDay(a,"2026-10-05").paid).toBe(0);});
  it("requires every rent component and excludes services from calendar progress",()=>{
    const a=fixture(),i={...input(a),paidThrough:"",coverageFrom:"",opening:"0",calculationFrom:"2026-10-05"};
    a.schedules.push({...a.schedules[0],id:"extra-rent",rates:[{effectiveDate:"2026-07-13",amountPence:3000}]},{...a.schedules[0],id:"service",kind:"service",rates:[{effectiveDate:"2026-07-13",amountPence:4000}]});
    applyReconciliation(a,i,"admin");a.charges.push(...projectCharges(a));const rent=a.charges.find(c=>c.sourceId==="rent")!,extra=a.charges.find(c=>c.sourceId==="extra-rent")!,service=a.charges.find(c=>c.sourceId==="service")!;
    const p={id:"p",requestId:"p",accountId:a.id,amountPence:11000,receivedDate:"2026-10-05",method:"cash",reference:"",recordedBy:"admin",createdAt:"",allocations:[{chargeId:rent.id,amountPence:7000},{chargeId:service.id,amountPence:4000}]};a.payments.push(p);
    expect(calendarDay(a,"2026-10-05")).toMatchObject({status:"partial",total:10000,paid:7000,percent:70});expect(rentCoverage(a).through).toBeUndefined();
    p.amountPence+=3000;p.allocations.push({chargeId:extra.id,amountPence:3000});expect(calendarDay(a,"2026-10-05").status).toBe("paid");expect(rentCoverage(a).through).toBe("2026-10-11");
  });
  it("rejects reuse of a saved request with a different confirmed amount",()=>{const a=fixture(),i=input(a);applyReconciliation(a,i,"admin");expect(()=>applyReconciliation(a,{...i,opening:"1"},"admin")).toThrow(/different values/);});
});

function simple(a:LedgerAccount):ReconcileInput {
  return {...input(a),setupMode:"calculator",first:"",calculationFrom:"",paidThrough:"",coverageFrom:"",opening:"",reason:"",lastPaymentDate:"2026-08-17",lastPaymentAmount:"325",firstUnpaid:"2026-09-14",previousRent:"65",newRent:"70",effectiveDate:"2026-10-05",frequency:"weekly",calculationDate:"2026-10-05"};
}
describe("simple rent-book setup",()=>{
  it("Barry: three old weeks, one current week, evidence only and next Monday",()=>{
    const a=fixture(),i=simple(a);a.name="Barry";a.unitIds=["12A"];a.schedules=[];
    const c=calculateReconciliation(a,i);
    expect(c.lines.map(x=>[x.periodStart,x.amountPence])).toEqual([["2026-09-14",6500],["2026-09-21",6500],["2026-09-28",6500]]);
    expect(c.calculatedPence).toBe(19500);expect(c.asOf).toBe("2026-10-04");expect(c.currentCharges).toHaveLength(1);
    expect(c.currentCharges[0]).toMatchObject({periodStart:"2026-10-05",periodEnd:"2026-10-11",dueDate:"2026-10-05",amountPence:7000});expect(c.nextDueDate).toBe("2026-10-12");
    applyReconciliation(a,i,"admin");a.charges.push(...projectCharges(a));
    expect(balances(a).net).toBe(26500);expect(a.adjustments).toHaveLength(0);expect(a.payments).toHaveLength(0);
    expect(a.reconciliation).toMatchObject({paidThrough:"2026-09-13",openingPence:19500,lastPaymentAmountPence:32500});
    expect(rentCoverage(a).through).toBe("2026-09-13");expect(calendarDay(a,"2026-09-21").status).toBe("overdue");
    expect(calendarDay(a,"2026-10-05")).toMatchObject({total:7000,label:"Due today"});expect(calendarDay(a,"2026-10-12").label).toBe("Future unpaid");
    const saved=structuredClone(a);applyReconciliation(a,i,"admin");expect(a).toEqual(saved);
    expect(()=>applyReconciliation(a,{...i,requestId:randomUUID()},"admin")).toThrow(/already active/);expect(a).toEqual(saved);
  });
  it("S6 Customs: combined monthly account charges October once, September settled",()=>{
    const a=fixture();a.unitIds=["17","18","19"];a.schedules=[];
    const i={...simple(a),frequency:"monthly" as const,firstUnpaid:"2026-10-01",previousRent:"",newRent:"1200",effectiveDate:"2026-10-01",lastPaymentDate:"",lastPaymentAmount:"",coverageFrom:"2026-09-01"};
    const c=calculateReconciliation(a,i);expect(c.calculatedPence).toBe(0);expect(c.asOf).toBe("2026-09-30");expect(c.lines).toHaveLength(0);expect(c.currentCharges).toHaveLength(1);expect(c.nextDueDate).toBe("2026-11-01");
    applyReconciliation(a,i,"admin");a.charges.push(...projectCharges(a));expect(balances(a).net).toBe(120000);expect(a.charges).toHaveLength(1);expect(a.charges[0]).toMatchObject({periodStart:"2026-10-01",periodEnd:"2026-10-31",dueDate:"2026-10-01",amountPence:120000});
    expect(a.reconciliation?.paidThrough).toBe("2026-09-30");expect(calendarDay(a,"2026-09-15").status).toBe("paid");expect(a.adjustments).toHaveLength(0);
  });
  it("accepts all optional date blanks with a manual balance and no historical schedule",()=>{
    const a=fixture();a.schedules=[];
    const i={...simple(a),setupMode:"manual" as const,firstUnpaid:"",previousRent:"",opening:"195",reason:"Confirmed rent book",lastPaymentDate:"",lastPaymentAmount:"",paidThrough:"",coverageFrom:"",calculationFrom:""};
    const c=calculateReconciliation(a,i);expect(c.available).toBe(false);applyReconciliation(a,i,"admin");a.charges.push(...projectCharges(a));expect(balances(a).net).toBe(26500);expect(a.adjustments).toHaveLength(1);expect(a.charges.filter(x=>x.id.startsWith("reconciled:"))).toHaveLength(0);
  });
  it("fixes the actual optional coverageFrom regression with paidThrough supplied",()=>{
    const a=fixture();const i={...input(a),coverageFrom:"",calculationFrom:"",opening:"195"};
    expect(()=>calculateReconciliation(a,i)).not.toThrow();expect(()=>applyReconciliation(a,i,"admin")).not.toThrow();expect(a.reconciliation?.coverageFrom).toBeUndefined();
  });
  it("manual credit remains separate from the current charge",()=>{
    const a=fixture(),i={...simple(a),setupMode:"manual" as const,firstUnpaid:"",opening:"-100",reason:"Credit per rent book",lastPaymentDate:"",lastPaymentAmount:""};
    applyReconciliation(a,i,"admin");a.charges.push(...projectCharges(a));expect(a.reconciliation?.openingPence).toBe(-10000);expect(balances(a).net).toBe(-3000);expect(a.payments).toHaveLength(1);expect(a.payments[0].legacyId).toBe("reconciliation-credit");
  });
  it("only adjusts the difference when overriding calculated arrears",()=>{
    const a=fixture(),i={...simple(a),opening:"150",reason:"Book confirms a £45 historical credit"};
    applyReconciliation(a,i,"admin");a.charges.push(...projectCharges(a));expect(a.charges.filter(c=>c.id.startsWith("reconciled:"))).toHaveLength(3);expect(a.adjustments.map(x=>x.amountPence)).toEqual([-4500]);expect(balances(a).net).toBe(22000);expect(calendarDay(a,"2026-09-14").status).toBe("partial");
    expect(a.audit.at(-1)?.detail).toMatchObject({manualOverride:true,lastPaymentIsEvidenceOnly:true});
  });
  it("uses field-specific errors for invalid dates and requires explicit cycle starts",()=>{
    const a=fixture(),i=simple(a);
    for(const [field,value] of [["firstUnpaid","2026-09-15"],["effectiveDate","2026-02-30"],["lastPaymentDate","wrong"],["coverageFrom","2026-13-01"]]){
      try{normaliseReconciliation({...i,[field]:value},true);throw new Error("expected validation failure");}catch(e){expect(e).toMatchObject({field});}
    }
    expect(()=>calculateReconciliation(a,{...i,firstUnpaid:"2026-09-15"})).toThrow(/Monday explicitly/);
    expect(()=>calculateReconciliation(a,{...i,frequency:"monthly",firstUnpaid:"2026-09-14"})).toThrow(/1st of the month/);
  });
  it("prorates the exact rate boundary without backdating the new rent",()=>{
    const a=fixture(),i={...simple(a),effectiveDate:"2026-09-30"};const c=calculateReconciliation(a,i);
    expect(c.lines.map(x=>x.amountPence)).toEqual([6500,6500,6857]);expect(c.lines[2].calculation).toEqual([{from:"2026-09-28",to:"2026-09-29",ratePence:6500,days:2,denominator:7},{from:"2026-09-30",to:"2026-10-04",ratePence:7000,days:5,denominator:7}]);
  });
  it("deduplicates separately verified legacy receipts against their ledger identities",()=>{
    const a=fixture(),i={...simple(a),deductKnownPayments:true};a.migration.snapshot={payments:[{id:"legacy-payment",paymentDate:"2026-09-21",amountPence:3500},{id:"legacy-payment",paymentDate:"2026-09-21",amountPence:3500}]};
    a.payments.push({id:"imported-payment",requestId:"imported-payment",legacyId:"legacy-payment",accountId:a.id,amountPence:3500,receivedDate:"2026-09-21",method:"cash",reference:"",allocations:[],recordedBy:"admin",createdAt:""});
    const c=calculateReconciliation(a,i);expect(c.knownPayments).toHaveLength(1);expect(c.calculatedPence).toBe(16000);
    applyReconciliation(a,i,"admin");expect(a.payments).toHaveLength(1);expect(a.adjustments).toHaveLength(0);expect(balances(a).net).toBe(16000);expect(calendarDay(a,"2026-09-14").status).toBe("partial");
  });
});

describe("monthly boundaries and existing allocations",()=>{
  it("includes a charge due on the calculation date and preserves the old September rate",()=>{
    const a=fixture(),i={...simple(a),frequency:"monthly" as const,firstUnpaid:"2026-09-01",previousRent:"1000",newRent:"1200",effectiveDate:"2026-10-01",calculationDate:"2026-10-01"};
    const c=calculateReconciliation(a,i);expect(c.lines.map(x=>x.amountPence)).toEqual([100000]);expect(c.currentCharges[0].amountPence).toBe(120000);expect(c.currentCharges[0].dueDate).toBe("2026-10-01");expect(c.nextDueDate).toBe("2026-11-01");
    const split=calculateReconciliation(a,{...i,effectiveDate:"2026-09-16"});expect(split.lines[0].amountPence).toBe(110000);expect(split.lines[0].calculation?.map(x=>x.days)).toEqual([15,15]);
  });
  it("does not reuse money already allocated to services or change that history",()=>{
    const a=fixture(),i={...simple(a),deductKnownPayments:true};
    const service={id:"service-charge",accountId:a.id,sourceId:"service",category:"service" as const,description:"Service",dueDate:"2026-09-21",amountPence:5000,coverageKnown:false};a.charges.push(service);
    a.payments.push({id:"service-payment",requestId:"service-payment",accountId:a.id,amountPence:3500,receivedDate:"2026-09-21",method:"cash",reference:"",allocations:[{chargeId:service.id,amountPence:3500}],recordedBy:"admin",createdAt:""});
    const payment=structuredClone(a.payments[0]);expect(calculateReconciliation(a,i).knownPayments).toHaveLength(0);
    applyReconciliation(a,i,"admin");expect(a.payments[0]).toEqual(payment);expect(a.charges[0]).toEqual(service);expect(a.adjustments).toHaveLength(0);expect(balances(a).net).toBe(21000);
  });
});

it("accepts a known last-payment amount without its optional date",()=>{
  const a=fixture(),i={...simple(a),setupMode:"manual" as const,firstUnpaid:"",lastPaymentDate:"",lastPaymentAmount:"325",opening:"195",reason:"Book balance; receipt date unknown"};
  expect(()=>normaliseReconciliation(i,true)).not.toThrow();applyReconciliation(a,i,"admin");
  expect(a.reconciliation).toMatchObject({lastPaymentDate:undefined,lastPaymentAmountPence:32500,openingPence:19500});expect(a.payments).toHaveLength(0);
});

it("a later manual correction preserves confirmed historical coverage and evidence when optional dates are blank",()=>{
  const a=fixture(),i={...simple(a),coverageFrom:"2026-09-07"};applyReconciliation(a,i,"admin");a.charges.push(...projectCharges(a));
  applyReconciliation(a,{...i,requestId:randomUUID(),setupMode:"manual",opening:"265",reason:"Balance rechecked",lastPaymentDate:"",lastPaymentAmount:"",coverageFrom:"",paidThrough:""},"admin");
  expect(a.reconciliation).toMatchObject({coverageFrom:"2026-09-07",paidThrough:"2026-09-13",lastPaymentDate:"2026-08-17",lastPaymentAmountPence:32500});expect(a.adjustments).toHaveLength(0);expect(a.payments).toHaveLength(0);expect(a.charges).toHaveLength(4);
});
