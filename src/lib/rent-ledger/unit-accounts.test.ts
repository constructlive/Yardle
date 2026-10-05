import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { prepareRentAccountGrouping, prepareUnitRentAccount, tenantGroupId, type UnitRentInput } from "./unit-accounts";
import { balances } from "./engine";
import { resolvePrincipal } from "../tenant-portal/policy";
import type { LedgerAccount } from "./types";
function tenant():LedgerAccount{return{id:randomUUID(),name:"Meadspeed",contactName:"Owner",email:"",mobile:"",unitIds:[],state:"review",version:0,schedules:[],charges:[],payments:[],adjustments:[],audit:[],portalEnabled:false,migration:{importedAt:"",originalOpeningPence:0,suggestedOpeningPence:0,legacyThroughDate:"",warnings:[],snapshot:{original:"preserved"}}};}
function input(parent:LedgerAccount,unitId="unit-2-3",amount=7000):UnitRentInput{const id=randomUUID();return{parentId:parent.id,version:parent.version,requestId:id,unitId,unitReference:unitId==="unit-2-3"?"2/3":"7",confirmMove:false,schedule:{id,name:"Rent",kind:"rent",frequency:"weekly",startDate:"2026-10-05",dueDay:1,timing:"advance",partialRule:"daily",enabled:true,rates:[{effectiveDate:"2026-10-05",amountPence:amount}]}};}
describe("separate unit rent accounts",()=>{
  it("sets up the first unit on an empty tenant account without assuming an opening balance",()=>{const a=tenant(),before=structuredClone(a.migration),i=input(a);const result=prepareUnitRentAccount([a],i,"admin");expect(result.accountId).toBe(a.id);expect(a.unitIds).toEqual(["unit-2-3"]);expect(a.schedules[0].rates[0].amountPence).toBe(7000);expect(a.state).toBe("review");expect(a.approval).toBeUndefined();expect(a.charges).toEqual([]);expect(a.migration).toEqual(before);});
  it("gives Meadspeed Unit 7 its own rate and preserves Unit 2/3 balances and payments",()=>{
    const a=tenant();prepareUnitRentAccount([a],input(a),"admin");a.state="active";a.charges.push({id:"old-charge",accountId:a.id,sourceId:"r",category:"rent",description:"Old rent",dueDate:"2026-10-01",amountPence:14000,coverageKnown:false});a.payments.push({id:"p",requestId:"p",accountId:a.id,amountPence:7000,receivedDate:"2026-10-02",createdAt:"2026-10-02",method:"cash",reference:"",recordedBy:"admin",allocations:[{chargeId:"old-charge",amountPence:7000}]});
    const before=structuredClone(a),result=prepareUnitRentAccount([a],input(a,"unit-7",9500),"admin"),second=result.changed[0];
    expect(a).toEqual(before);expect(tenantGroupId(second)).toBe(a.id);expect(second.unitIds).toEqual(["unit-7"]);expect(second.schedules[0].rates[0].amountPence).toBe(9500);expect(second.payments).toEqual([]);expect(second.charges).toEqual([]);expect(second.approval).toBeUndefined();expect(balances(a,"2026-10-05").outstanding).toBe(7000);
  });
  it("requires explicit confirmation to separate an unused combined draft and retains archived history",()=>{const a=tenant();a.unitIds=["unit-2-3","unit-7"];const before=structuredClone(a.migration),i={...input(a,"unit-7"),sourceVersion:a.version};expect(()=>prepareUnitRentAccount([a],i,"admin")).toThrow(/Confirm/);const result=prepareUnitRentAccount([a],{...i,confirmMove:true},"admin");expect(a.unitIds).toEqual(["unit-2-3"]);expect(a.migration).toEqual(before);expect(result.changed.find(x=>x.id!==a.id)?.unitIds).toEqual(["unit-7"]);});
  it("never splits a confirmed or financially used account",()=>{const a=tenant();a.unitIds=["unit-2-3","unit-7"];a.state="active";const before=structuredClone(a);expect(()=>prepareUnitRentAccount([a],{...input(a,"unit-7"),sourceVersion:a.version,confirmMove:true},"admin")).toThrow(/cannot be split automatically/);expect(a).toEqual(before);});
  it("rejects another tenant's unit and stale account versions",()=>{const a=tenant(),other=tenant();other.unitIds=["unit-7"];expect(()=>prepareUnitRentAccount([a,other],input(a,"unit-7"),"admin")).toThrow(/another tenant/);expect(()=>prepareUnitRentAccount([a],{...input(a),version:9},"admin")).toThrow(/changed/);});
  it("deduplicates retries and rejects changed requests or ID collisions",()=>{const a=tenant(),i=input(a);prepareUnitRentAccount([a],i,"admin");expect(prepareUnitRentAccount([a],i,"admin").changed).toEqual([]);expect(()=>prepareUnitRentAccount([a],{...i,unitId:"unit-7"},"admin")).toThrow(/different values/);expect(()=>prepareUnitRentAccount([a],{...input(a,"unit-7"),requestId:a.id},"admin")).toThrow(/conflicts/);});
  it("does not grant sibling account access from tenant grouping",()=>{const a=tenant(),other=tenant();other.tenantGroupId=a.id;a.portalEnabled=true;a.portalScope=[];a.portalToken="a".repeat(64);other.portalEnabled=true;other.portalScope=[];other.portalToken="b".repeat(64);expect(resolvePrincipal(a.portalToken,[a,other],[])?.accountId).toBe(a.id);expect(resolvePrincipal(other.portalToken,[a,other],[])?.accountId).toBe(other.id);});
});

describe("explicit grouping of existing rent accounts",()=>{
  it("groups two existing accounts without altering their units, balances, rates or portal credentials",()=>{
    const a=tenant(),b=tenant();a.unitIds=["unit-2-3"];b.unitIds=["unit-7"];b.state="active";b.portalEnabled=true;b.portalToken="b".repeat(64);b.schedules=[input(b,"unit-7",9500).schedule];
    const before=structuredClone(b);
    prepareRentAccountGrouping([a,b],a.id,a.version,b.id,b.version,"admin");
    expect(b).toEqual({...before,tenantGroupId:a.id,version:before.version+1,audit:b.audit});
    expect(a.audit.at(-1)?.type).toBe("tenant_rent_account_linked");expect(b.audit.at(-1)?.actor).toBe("admin");
  });
  it("rejects stale links and cycles or nested groups",()=>{
    const a=tenant(),b=tenant(),c=tenant();
    expect(()=>prepareRentAccountGrouping([a,b],a.id,5,b.id,b.version,"admin")).toThrow(/changed/);
    prepareRentAccountGrouping([a,b,c],a.id,a.version,b.id,b.version,"admin");
    expect(()=>prepareRentAccountGrouping([a,b,c],b.id,b.version,a.id,a.version,"admin")).toThrow(/already belongs/);
    expect(()=>prepareRentAccountGrouping([a,b,c],c.id,c.version,a.id,a.version,"admin")).toThrow(/already belongs/);
  });
});
