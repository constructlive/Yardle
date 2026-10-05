import { describe, it, expect } from "vitest";
import { migrationDrafts } from "./migrate";
import { getDemoAppData } from "../demo-store";
import { releaseUnconfirmedUnits } from "./manual-units";
function imported() {
  const account = migrationDrafts(getDemoAppData())[0];
  account.unitIds = ["old-inferred-unit"];
  return account;
}
describe("manual unit assignment migration", () => {
  it("starts imported tenant accounts with no assigned units and preserves their source archive", () => {
    const drafts = migrationDrafts(getDemoAppData());
    expect(drafts.every(a => a.unitIds.length === 0)).toBe(true);
    expect(drafts.some(a => (a.migration.snapshot as {units:unknown[]}).units.length > 0)).toBe(true);
  });
  it("releases inferred draft links once, retaining every other field", () => {
    const a = imported(), before = structuredClone(a);
    expect(releaseUnconfirmedUnits(a)).toEqual(["old-inferred-unit"]);
    expect(a).toEqual({...before, unitIds:[]});
    expect(releaseUnconfirmedUnits(a)).toEqual([]);
  });
  it("preserves active and paused account assignments", () => {
    for (const state of ["active","paused"] as const) { const a=imported();a.state=state;expect(releaseUnconfirmedUnits(a)).toEqual([]);expect(a.unitIds).toHaveLength(1); }
  });
  it("preserves administrator-confirmed units and portal mappings", () => {
    const a=imported();a.audit.push({id:"e",actor:"admin",at:"",type:"unit_membership_changed",detail:{}});
    expect(releaseUnconfirmedUnits(a)).toEqual([]);
    const b=imported();b.portalEnabled=true;expect(releaseUnconfirmedUnits(b)).toEqual([]);
    const c=imported();c.portalScope=[];expect(releaseUnconfirmedUnits(c)).toEqual([]);
  });
  it("preserves any draft that already has financial entries", () => {
    const a=imported();a.charges.push({id:"c",accountId:a.id,sourceId:"s",category:"rent",description:"Manual",dueDate:"2026-10-05",amountPence:7000,coverageKnown:false});
    expect(releaseUnconfirmedUnits(a)).toEqual([]);
  });
});
