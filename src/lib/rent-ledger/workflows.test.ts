import { previewCalendarReconciliation, saveCalendarReconciliation } from "./reconcile-actions";
import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("../session", () => ({ requireAdminSession: async () => ({ userId: "test-admin", role: "admin" }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../db", () => ({ hasDatabaseUrl: () => false, ensureSeeded: async () => {}, query: vi.fn(), transaction: vi.fn() }));
const providerSend = vi.hoisted(() => vi.fn());
vi.mock("../sms", () => ({ getSmsProvider: () => ({ send: providerSend }) }));
vi.mock("../sms-logging", () => ({ getActiveSmsProviderName: async () => "mock", sendAndLogSms: vi.fn() }));
import { randomUUID } from "node:crypto";
import { removeRentAccount, addAdjustment, addRate, allocateCredit, approveReconciliation, previewReceipt, previewReconciliation, recordReceipt, reverseReceipt, sendReceiptConfirmation } from "./actions";
import { archiveRentAccount, catchUpAccount, createAccount, mutateAccount, readAccounts, setUnitMembership } from "./store";
import { balances, chargesWithProjections, rentCoverage, today } from "./engine";
import type { LedgerAccount, PaymentInput } from "./types";

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-05T12:00:00Z")); });
async function draft() {
  const a: LedgerAccount = { id: randomUUID(), name: "Test account", contactName: "Account owner", mobile: "07700900001", email: "", unitIds: [], schedules: [{ id: randomUUID(), name: "Weekly rent", kind: "rent", frequency: "weekly", startDate: "2026-10-05", dueDay: 1, timing: "advance", partialRule: "daily", enabled: true, rates: [{ effectiveDate: "2026-10-05", amountPence: 7000 }] }], charges: [], payments: [], adjustments: [], audit: [], version: 0, state: "review", portalEnabled: false, migration: { importedAt: "", originalOpeningPence: 99999, suggestedOpeningPence: 99999, legacyThroughDate: "2026-10-04", warnings: [], snapshot: { original: "preserved" } } };
  await createAccount(a); return a;
}
async function current(id: string) { return (await readAccounts()).find(a => a.id === id)!; }
async function activate(opening = "0.00") {
  const a = await draft(); await approveReconciliation({ accountId: a.id, version: a.version, opening, first: today(), note: "Agreed figures verified", confirmed: true }); return current(a.id);
}
function payment(a: LedgerAccount, amountPence = 7000): PaymentInput { return { accountId: a.id, version: a.version, requestId: randomUUID(), amountPence, receivedDate: today(), method: "bank_transfer", reference: "REF-1", allocations: [{ chargeId: a.charges.find(c => c.category === "rent")!.id, amountPence: Math.min(amountPence,7000) }] }; }
function form(a: LedgerAccount, fields: Record<string,string>) { const f = new FormData(); f.set("accountId",a.id); f.set("version",String(a.version)); for (const [k,v] of Object.entries(fields)) f.set(k,v); return f; }

describe("account workflow and retries", () => {
  it("previews opening balances without activation and requires sign-off", async () => {
    const a = await draft(); const input = { accountId:a.id, version:a.version, opening:"100.00",first:today(),note:"Agreed" };
    const preview = await previewReconciliation(input); expect(preview.balances).toMatchObject({ outstanding:17000,overdue:10000 });
    expect((await current(a.id)).state).toBe("review");
    await expect(approveReconciliation({...input,confirmed:false})).rejects.toThrow();
    await approveReconciliation({...input,confirmed:true}); const saved=await current(a.id);
    expect(saved.charges).toHaveLength(2); expect(saved.migration.snapshot).toEqual({original:"preserved"});expect(saved.approval?.actor).toBe("test-admin");
    await expect(approveReconciliation({...input,version:saved.version,confirmed:true})).rejects.toThrow();
  });
  it("uses confirmed credit instead of unconfirmed legacy balances", async () => {
    const a=await activate("-100.00"); expect(balances(a)).toMatchObject({credit:10000,outstanding:0}); expect(a.migration.suggestedOpeningPence).toBe(99999);
    const p:PaymentInput={...payment(a,10000), allocations:[{chargeId:a.charges[0].id,amountPence:7000}]};
    await allocateCredit(p,a.payments[0].id);const saved=await current(a.id);expect(balances(saved).credit).toBe(3000);expect(rentCoverage(saved).through).toBe("2026-10-11");expect(saved.payments).toHaveLength(1);
    await allocateCredit(p,a.payments[0].id);expect((await current(a.id)).payments).toHaveLength(1);
  });
  it("serializes repeated catch-up and preserves stable period ids", async () => {
    const a=await activate();const count=await Promise.all([mutateAccount(a.id,x=>catchUpAccount(x,"2026-10-26")),mutateAccount(a.id,x=>catchUpAccount(x,"2026-10-26"))]);
    expect(count.reduce((n,c)=>n+c,0)).toBe(3);const saved=await current(a.id);expect(saved.charges).toHaveLength(4);expect(new Set(saved.charges.map(c=>c.id)).size).toBe(4);
  });
  it("saves a retried payment once and rejects stale competing allocations", async () => {
    const a=await activate(); const p=payment(a); const receipts=await Promise.all([recordReceipt(p),recordReceipt(p)]);
    expect(receipts[0].id).toBe(receipts[1].id);expect((await current(a.id)).payments).toHaveLength(1);
    await expect(recordReceipt({...p,requestId:randomUUID()})).rejects.toThrow("changed");await expect(recordReceipt({...p,amountPence:9999})).rejects.toThrow("retry key");
  });
  it("keeps a saved payment after SMS failure and independently retries only SMS", async () => {
    const a=await activate();const p=await recordReceipt(payment(a)); expect(p.confirmation?.mobile).toBe(a.mobile); expect(p.confirmation?.state).toBe("prepared");
    providerSend.mockResolvedValueOnce({status:"failed",providerReference:"",failureReason:"Invalid destination"});await sendReceiptConfirmation(a.id,p.id);
    expect((await current(a.id)).payments).toHaveLength(1); expect((await current(a.id)).payments[0].confirmation?.state).toBe("failed");
    providerSend.mockResolvedValueOnce({status:"simulated",providerReference:"mock-1"});await sendReceiptConfirmation(a.id,p.id);expect((await current(a.id)).payments).toHaveLength(1);
    await expect(sendReceiptConfirmation(a.id,p.id)).rejects.toThrow("already");
  });
  it("reverses a receipt with actor and reason without deleting it", async () => {
    const a=await activate();const p=await recordReceipt(payment(a));const saved=await current(a.id);await reverseReceipt(form(saved,{paymentId:p.id,reason:"Entered twice by administrator"}));const reversed=await current(a.id);
    expect(reversed.payments[0]).toMatchObject({reversedBy:"test-admin",reversalReason:"Entered twice by administrator"});expect(balances(reversed).outstanding).toBe(7000);expect(rentCoverage(reversed).through).toBeUndefined();
    await expect(reverseReceipt(form(reversed,{paymentId:p.id,reason:"Again"}))).rejects.toThrow("already");
  });
  it("adds only the dated difference for a rate increase inside an already posted period", async () => {
    const a=await activate();const original=structuredClone(a.charges[0]);await addRate(form(a,{sourceId:a.schedules[0].id,amount:"140.00",effectiveDate:"2026-10-09"}));const updated=await current(a.id);
    expect(updated.charges[0]).toEqual(original);expect(updated.charges[1]).toMatchObject({amountPence:3000,periodStart:"2026-10-09",dueDate:"2026-10-09",baseChargeId:original.id});expect(balances(updated).outstanding).toBe(7000);
    expect(chargesWithProjections(updated).find(c=>c.periodStart==="2026-10-12")?.amountPence).toBe(14000);
    const p=payment(updated);const preview=await previewReceipt(p);expect(preview.paidThrough).toBe("2026-10-08");expect(preview.covered).toHaveLength(0);expect(preview.message).not.toContain("2026-10-05 to 2026-10-11");
  });
  it("audits an adjustment once without double counting its metadata", async () => {
    const a=await activate();await addAdjustment(form(a,{amount:"20.00",reason:"Agreed extra rent",date:today(),category:"rent"}));let saved=await current(a.id);expect(balances(saved).outstanding).toBe(9000);
    await addAdjustment(form(saved,{amount:"-10.00",reason:"Agreed allowance",date:today(),category:"rent"}));saved=await current(a.id);expect(balances(saved)).toMatchObject({outstanding:8000,credit:1000});expect(saved.adjustments).toHaveLength(2);
  });
});


describe("manual tenant unit assignment", () => {
  it("assigns selected units without moving history and prevents duplicate ownership", async () => {
    const left=await draft(),right=await draft();
    await setUnitMembership(left.id,["manual-unit"],left.version,"admin","Chosen by administrator");
    const saved=await current(left.id);
    expect(saved.unitIds).toEqual(["manual-unit"]);
    expect(saved.migration).toEqual(left.migration);
    expect(saved.payments).toEqual(left.payments);
    expect(saved.charges).toEqual(left.charges);
    await expect(setUnitMembership(right.id,["manual-unit"],right.version,"admin","Duplicate")).rejects.toThrow(/already belongs/);
    await setUnitMembership(left.id,[],saved.version,"admin","Unassign");
    await setUnitMembership(right.id,["manual-unit"],right.version,"admin","Assign");
    expect((await current(right.id)).unitIds).toEqual(["manual-unit"]);
  });
  it("revokes old portal credentials when the selected units change", async () => {
    const a=await draft();
    await mutateAccount(a.id,account=>{account.unitIds=["old-unit"];account.portalEnabled=true;account.portalToken="old-token";account.portalScope=[{unitId:"old-unit",tenancy:"t"}];account.portalGrants=[{id:"g",unitId:"old-unit",tokenHash:"h",tenancy:"t",billIds:[],linkedAt:"",actor:"admin"}];});
    const before=await current(a.id);
    await setUnitMembership(a.id,["new-unit"],before.version,"admin","Corrected assignment");
    const saved=await current(a.id);
    expect(saved.portalEnabled).toBe(false);expect(saved.portalToken).toBeUndefined();expect(saved.portalScope).toBeUndefined();expect(saved.portalGrants![0].revokedAt).toBeTruthy();
    expect(saved.audit.at(-1)?.detail).toMatchObject({before:["old-unit"],after:["new-unit"],portalAccessRevoked:true});
  });
});


describe("removing rent accounts", () => {
  it("requires confirmation and a current version", async () => {
    const a = await draft();
    await expect(removeRentAccount(form(a, {}))).rejects.toThrow(/Confirm/);
    await expect(archiveRentAccount(a.id, a.version + 1, "admin")).rejects.toThrow(/changed/);
    expect(await current(a.id)).toBeDefined();
  });
  it("preserves money, revokes access, stops charges and allows units to be reassigned", async () => {
    let a = await activate("100.00");
    await recordReceipt(payment(a));
    a = await current(a.id);
    const unit = randomUUID();
    await setUnitMembership(a.id, [unit], a.version, "admin", "Confirmed unit");
    await mutateAccount(a.id, x => { x.portalEnabled = true; x.portalToken = "a".repeat(64); x.portalScope = []; x.portalGrants = [{ id: randomUUID(), unitId: unit, tokenHash: "hash", tenancy: "old", billIds: [], linkedAt: today(), actor: "admin" }]; });
    a = await current(a.id);
    await removeRentAccount(form(a, { confirmed: "on" }));
    expect(await current(a.id)).toBeUndefined();
    const archived = (await readAccounts(true)).find(x => x.id === a.id)!;
    expect(archived.charges).toEqual(a.charges);
    expect(archived.payments).toEqual(a.payments);
    expect(archived.migration).toEqual(a.migration);
    expect(archived.portalToken).toBeUndefined();
    expect(archived.portalScope).toBeUndefined();
    expect(archived.portalEnabled).toBe(false);
    expect(archived.portalGrants![0].revokedAt).toBeTruthy();
    expect(catchUpAccount(archived, "2027-01-01")).toBe(0);
    await expect(mutateAccount(a.id, x => { x.state = "active"; })).rejects.toThrow(/read-only/);
    await expect(setUnitMembership(a.id, [], archived.version, "admin", "Change")).rejects.toThrow();
    const replacement = await draft();
    await setUnitMembership(replacement.id, [unit], replacement.version, "admin", "Reassigned");
    expect((await current(replacement.id)).unitIds).toEqual([unit]);
    await archiveRentAccount(a.id, a.version, "admin");
    expect((await readAccounts(true)).find(x => x.id === a.id)!.audit.filter(e => e.type === "account_archived")).toHaveLength(1);
  });
  it("keeps other accounts visible when removing their group parent", async () => {
    const parent = await draft(), child = await draft();
    await mutateAccount(child.id, a => { a.tenantGroupId = parent.id; });
    await archiveRentAccount(parent.id, parent.version, "admin");
    const remaining = await current(child.id);
    expect(remaining.tenantGroupId).toBeUndefined();
    expect(remaining.audit.at(-1)?.type).toBe("tenant_group_removed");
    expect(remaining.schedules).toEqual(child.schedules);
  });
});


describe("reconciliation preview and save actions",()=>{
  const setup=(a:LedgerAccount):import("./reconciliation").ReconcileInput=>({accountId:a.id,version:a.version,requestId:randomUUID(),first:"",calculationFrom:"",lastPaymentDate:"",lastPaymentAmount:"",paidThrough:"",coverageFrom:"",opening:"",reason:"",setupMode:"calculator",frequency:"weekly",firstUnpaid:"2026-09-14",previousRent:"65",newRent:"70",effectiveDate:"2026-10-05",calculationDate:"2026-10-05"});
  it("previews without writes then saves the exact total once, including concurrent retries",async()=>{
    const a=await draft(),i=setup(a);const preview=await previewCalendarReconciliation(i);
    expect(preview.ok).toBe(true);if(!preview.ok)return;
    expect(preview.value.balances.net).toBe(26500);expect((await current(a.id)).charges).toHaveLength(0);
    expect((await saveCalendarReconciliation(i)).ok).toBe(false);
    const results=await Promise.all([saveCalendarReconciliation({...i,confirmed:true}),saveCalendarReconciliation({...i,confirmed:true})]);expect(results.every(r=>r.ok)).toBe(true);
    const saved=await current(a.id);expect(saved.charges).toHaveLength(4);expect(saved.adjustments).toHaveLength(0);expect(saved.payments).toHaveLength(0);expect(balances(saved).net).toBe(26500);
    expect((await saveCalendarReconciliation({...i,confirmed:true,newRent:"75"})).ok).toBe(false);
    expect(await current(a.id)).toEqual(saved);
  });
  it("accepts manual opening and blank optional dates in both actions",async()=>{
    const a=await draft(),i={...setup(a),setupMode:"manual" as const,firstUnpaid:"",previousRent:"",opening:"195",reason:"Confirmed book balance"};
    const preview=await previewCalendarReconciliation(i);expect(preview.ok).toBe(true);
    expect((await saveCalendarReconciliation({...i,confirmed:true})).ok).toBe(true);
    expect(balances(await current(a.id)).net).toBe(26500);
  });
  it("returns field-specific backend validation and cannot save an unexplained override",async()=>{
    const a=await draft(),i=setup(a);
    expect(await previewCalendarReconciliation({...i,firstUnpaid:"2026-09-15"})).toMatchObject({ok:false,fieldErrors:{firstUnpaid:expect.stringContaining("Monday")}});
    const override={...i,opening:"100"};expect((await previewCalendarReconciliation(override)).ok).toBe(true);
    expect(await saveCalendarReconciliation({...override,confirmed:true})).toMatchObject({ok:false,fieldErrors:{reason:expect.stringContaining("reason")}});
    expect((await current(a.id)).state).toBe("review");
  });
});
