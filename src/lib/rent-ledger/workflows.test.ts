import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("../session", () => ({ requireAdminSession: async () => ({ userId: "test-admin", role: "admin" }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../db", () => ({ hasDatabaseUrl: () => false, ensureSeeded: async () => {}, query: vi.fn(), transaction: vi.fn() }));
const providerSend = vi.hoisted(() => vi.fn());
vi.mock("../sms", () => ({ getSmsProvider: () => ({ send: providerSend }) }));
vi.mock("../sms-logging", () => ({ getActiveSmsProviderName: async () => "mock", sendAndLogSms: vi.fn() }));
import { randomUUID } from "node:crypto";
import { addAdjustment, addRate, allocateCredit, approveReconciliation, previewReceipt, previewReconciliation, recordReceipt, reverseReceipt, sendReceiptConfirmation } from "./actions";
import { catchUpAccount, createAccount, mutateAccount, readAccounts } from "./store";
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
