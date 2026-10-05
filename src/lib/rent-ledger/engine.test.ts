import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, balances, chargesWithProjections, money, paymentMessage, previewPayment, projectCharges, rentCoverage, suggestAllocation, validDate, validatePayment } from "./engine";
import type { LedgerAccount, PaymentInput } from "./types";
import { migrationDrafts } from "./migrate";
import { getDemoAppData } from "../demo-store";

export function fixture(): LedgerAccount {
  return { id: "a", name: "Combined business", contactName: "Owner", mobile: "07700900000", email: "", unitIds: ["u1", "u2"], schedules: [{ id: "rent", name: "Rent", kind: "rent", frequency: "weekly", startDate: "2026-10-05", dueDay: 1, timing: "advance", partialRule: "daily", rates: [{ effectiveDate: "2026-10-05", amountPence: 7000 }], enabled: true }], charges: [], payments: [], adjustments: [], audit: [], version: 0, state: "active", portalEnabled: false, migration: { importedAt: "", originalOpeningPence: 0, suggestedOpeningPence: 0, legacyThroughDate: "", warnings: [], snapshot: {} }, approval: { actor: "admin", at: "", firstCoverageDate: "2026-10-05", confirmedOpeningPence: 0, note: "Verified" } };
}
function input(a: LedgerAccount, amountPence: number): PaymentInput { return { accountId: a.id, version: a.version, requestId: "request-1", amountPence, receivedDate: "2026-10-05", method: "bank_transfer", reference: "Bank ref", allocations: [] }; }
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-05T12:00:00Z")); });
afterEach(() => vi.useRealTimers());

describe("dated schedules", () => {
  it("gates unapproved accounts and charges combined units once", () => {
    const a = fixture(); a.approval = undefined; expect(projectCharges(a)).toEqual([]);
    a.approval = fixture().approval; const rows = projectCharges(a); expect(rows).toHaveLength(1); expect(rows[0].accountId).toBe("a"); expect(rows[0]).not.toHaveProperty("unitId");
  });
  it("prorates a partial week and splits exactly at a rent increase", () => {
    const a = fixture(); a.approval!.firstCoverageDate = "2026-10-07"; a.schedules[0].rates.push({ effectiveDate: "2026-10-09", amountPence: 14000 });
    expect(projectCharges(a, "2026-10-11")[0]).toMatchObject({ amountPence: 8000, periodStart: "2026-10-07", periodEnd: "2026-10-11" });
  });
  it("retains old rates in previous periods", () => {
    const a = fixture(); a.schedules[0].rates.push({ effectiveDate: "2026-10-12", amountPence: 14000 });
    expect(projectCharges(a, "2026-10-18").map(c => c.amountPence)).toEqual([7000, 14000]);
  });
  it("charges full partial periods while respecting exact rate dates", () => {
    const a = fixture(); a.approval!.firstCoverageDate = "2026-10-07"; a.schedules[0].partialRule = "full";
    expect(projectCharges(a, "2026-10-11")[0].amountPence).toBe(7000);
    a.schedules[0].rates.push({ effectiveDate: "2026-10-09", amountPence: 14000 }); expect(projectCharges(a, "2026-10-11")[0].amountPence).toBe(11200);
  });
  it("clamps monthly due days without drifting after leap February", () => {
    const a = fixture(); a.approval!.firstCoverageDate = "2028-01-31"; Object.assign(a.schedules[0], { frequency: "monthly", startDate: "2028-01-31", dueDay: 31, rates: [{ effectiveDate: "2028-01-31", amountPence: 31000 }] });
    expect(projectCharges(a, "2028-04-30").map(c => c.periodStart)).toEqual(["2028-01-31", "2028-02-29", "2028-03-31", "2028-04-30"]);
  });
  it("does not treat future arrears-scheduled rent as currently overdue", () => {
    const a = fixture(); a.schedules[0].timing = "arrears"; a.charges = projectCharges(a);
    expect(a.charges[0].dueDate).toBe("2026-10-12"); expect(balances(a)).toMatchObject({ outstanding: 0, overdue: 0, upcoming: 7000 });
    expect(balances(a, "2026-10-12")).toMatchObject({ outstanding: 7000, overdue: 0 }); expect(balances(a, "2026-10-13").overdue).toBe(7000);
  });
  it("honours independent service frequency, start and end", () => {
    const a = fixture(); a.schedules.push({ ...a.schedules[0], id: "parking", name: "Parking", kind: "service", frequency: "monthly", startDate: "2026-10-10", endDate: "2026-10-20", dueDay: 1, rates: [{ effectiveDate: "2026-10-10", amountPence: 3100 }] });
    const services = projectCharges(a, "2026-12-31").filter(c => c.category === "service"); expect(services).toHaveLength(1);
    expect(services[0]).toMatchObject({ amountPence: 1100, periodStart: "2026-10-10", periodEnd: "2026-10-20" });
  });
  it("does not replace posted snapshots with projections", () => {
    const a = fixture(); a.charges = projectCharges(a); a.schedules[0].rates[0].amountPence = 9999; expect(chargesWithProjections(a)[0].amountPence).toBe(7000);
  });
});
describe("allocations and coverage", () => {
  it("settles oldest opening arrears first without inferring full coverage", () => {
    const a = fixture(); a.charges = projectCharges(a); a.charges.unshift({ id: "opening", accountId: "a", category: "opening", sourceId: "opening", description: "Brought forward", amountPence: 10000, dueDate: "2026-10-04", coverageKnown: false });
    const p = input(a, 14000); p.allocations = suggestAllocation(a,p.amountPence,a.charges); const r = previewPayment(a,p,a.charges);
    expect(p.allocations.map(x => x.amountPence)).toEqual([10000,4000]); expect(r.coverage.through).toBeUndefined(); expect(r.balances.outstanding).toBe(3000);
  });
  it("covers two weeks across a rate change without settling services", () => {
    const a = fixture(); a.schedules[0].rates.push({ effectiveDate: "2026-10-12", amountPence: 14000 }); a.schedules.push({ ...a.schedules[0], id: "parking", kind: "service", name: "Parking", rates: [{ effectiveDate: "2026-10-05", amountPence: 1000 }] }); a.charges = projectCharges(a);
    const charges = chargesWithProjections(a); const p = input(a,21000); p.allocations = suggestAllocation(a,p.amountPence,charges,{ from: "2026-10-05", to: "2026-10-18" });
    const r = previewPayment(a,p,charges); expect(r.coverage.through).toBe("2026-10-18"); expect(r.balances.services).toBe(1000);
  });
  it.each([2,6,12])("allocates exactly %i weekly periods", weeks => {
    const a = fixture(); const charges = chargesWithProjections(a); const p = input(a,7000*weeks); p.allocations = suggestAllocation(a,p.amountPence,charges,{from:"2026-10-05",to:addDays("2026-10-05",weeks*7-1)});
    expect(p.allocations).toHaveLength(weeks); expect(previewPayment(a,p,charges).coverage.through).toBe(addDays("2026-10-05",weeks*7-1));
  });
  it("keeps unallocated receipts as credit without inventing paid-through dates", () => {
    const a = fixture(); a.charges = projectCharges(a); const r = previewPayment(a,input(a,50000),a.charges); expect(r.coverage.through).toBeUndefined(); expect(r.balances.credit).toBe(50000); expect(r.balances.rent).toBe(7000);
  });
  it("does not skip unpaid gaps or unpaid components", () => {
    const a = fixture(); const charges = chargesWithProjections(a); const p = input(a,7000); p.allocations=[{chargeId:charges[1].id,amountPence:7000}]; expect(previewPayment(a,p,charges).coverage.through).toBeUndefined();
    a.schedules.push({...a.schedules[0],id:"second",name:"Second rent"}); const both=projectCharges(a); p.allocations=[{chargeId:both[0].id,amountPence:7000}]; expect(previewPayment(a,p,both).coverage.through).toBeUndefined();
  });
  it("reversal restores debt and removes coverage while preserving the receipt", () => {
    const a=fixture(); a.charges=projectCharges(a); const p=input(a,7000); p.allocations=[{chargeId:a.charges[0].id,amountPence:7000}]; const next=previewPayment(a,p,a.charges).account;
    expect(rentCoverage(next).through).toBe("2026-10-11"); next.payments[0].reversedAt="2026-10-05T13:00:00Z"; expect(rentCoverage(next).through).toBeUndefined(); expect(balances(next).outstanding).toBe(7000); expect(next.payments).toHaveLength(1);
  });
  it("rejects excessive, duplicate, foreign allocations and future receipts", () => {
    const a=fixture(); const charges=projectCharges(a); const p=input(a,8000); p.allocations=[{chargeId:charges[0].id,amountPence:8000}]; expect(()=>validatePayment(a,p,charges)).toThrow();
    p.allocations=[{chargeId:charges[0].id,amountPence:1000},{chargeId:charges[0].id,amountPence:1000}]; expect(()=>validatePayment(a,p,charges)).toThrow(); p.allocations=[];p.receivedDate="2026-10-06"; expect(()=>validatePayment(a,p,charges)).toThrow(); p.receivedDate="2026-10-05";p.allocations=[{chargeId:"foreign",amountPence:1000}];expect(()=>validatePayment(a,p,charges)).toThrow();
  });
  it("validates dates and money and crosses DST without changing days", () => {
    expect(validDate("2026-02-30")).toBe(false); expect(addDays("2026-10-25",1)).toBe("2026-10-26"); expect(()=>money("NaN")).toThrow();expect(()=>money("1.001")).toThrow();expect(money("-25.50")).toBe(-2550);
  });
  it("prepares confirmation from actual allocations and the account name", () => {
    const a=fixture();a.charges=projectCharges(a);const p=input(a,10000);p.allocations=[{chargeId:a.charges[0].id,amountPence:7000}];const next=previewPayment(a,p,a.charges).account;const message=paymentMessage(next,next.payments[0]);expect(message).toContain("Combined business");expect(message).toContain("2026-10-05 to 2026-10-11");expect(message).toContain("£30.00");
  });
});
describe("migration", () => {
  it("archives unit history without activation, duplication or source mutation", () => {
    const data=getDemoAppData();const original=JSON.stringify(data);const drafts=migrationDrafts(data);expect(drafts.every(a=>a.state==="review"&&!a.approval&&!a.charges.length&&!a.payments.length)).toBe(true);expect(JSON.stringify(data)).toBe(original);const combined=drafts.find(a=>a.name==="S6 Customs")!;expect(combined.unitIds).toHaveLength(0);expect((combined.migration.snapshot as {units:unknown[]}).units).toHaveLength(3);expect((combined.migration.snapshot as {charges:unknown[]}).charges.length).toBeGreaterThan(0);
  });
  it("consolidates case-insensitive note grouping and preserves opening evidence", () => {
    const data=structuredClone(getDemoAppData());data.rentAccounts=[];data.rentAccountUnits=[];data.rentServices=[];data.rentSettings[0].notes='yardle_rent_meta:{"combinedAccount":"Grouped Payer"}';data.rentSettings[1].notes='yardle_rent_meta:{"combinedAccount":"grouped payer"}';const a=migrationDrafts(data).find(a=>a.name==="Grouped Payer")!;expect(a.unitIds).toHaveLength(0);expect((a.migration.snapshot as {units:unknown[]}).units).toHaveLength(2);expect((a.migration.snapshot as {settings:unknown[]}).settings).toHaveLength(2);
  });
});
