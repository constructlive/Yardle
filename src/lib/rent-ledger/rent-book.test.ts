import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { rentBookRows } from "./rent-book";
import { projectCharges } from "./engine";
import type { LedgerAccount, Receipt } from "./types";

function account(): LedgerAccount {
  return { id: "book", name: "Tenant", contactName: "", mobile: "", email: "", unitIds: ["u1"], state: "active", version: 1, portalEnabled: false, charges: [], payments: [], adjustments: [], audit: [], schedules: [{ id: "rent", name: "Unit 1 rent", kind: "rent", frequency: "weekly", startDate: "2026-10-06", dueDay: 2, timing: "advance", partialRule: "daily", enabled: true, rates: [{ effectiveDate: "2026-10-06", amountPence: 10000 }] }], approval: { actor: "admin", at: "", firstCoverageDate: "2026-10-06", confirmedOpeningPence: 0, note: "Checked" }, migration: { importedAt: "", originalOpeningPence: 0, suggestedOpeningPence: 0, legacyThroughDate: "", warnings: [], snapshot: {} } };
}
function receipt(chargeId: string, amountPence: number): Receipt {
  return { id: "receipt", accountId: "book", requestId: "request", amountPence, allocations: [{ chargeId, amountPence }], receivedDate: "2026-11-02", method: "cash", reference: "", recordedBy: "admin", createdAt: "" };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-02T12:00:00Z")); });
afterEach(() => vi.useRealTimers());

it("shows weekly gaps, part payments and future paid periods without using unallocated credit", () => {
  const a = account(); a.charges = projectCharges(a, "2026-11-10");
  a.payments = [receipt(a.charges[0].id, 10000), { ...receipt(a.charges[1].id, 5000), id: "part" }, { ...receipt(a.charges[4].id, 10000), id: "ahead" }, { ...receipt("", 50000), id: "credit", allocations: [] }];
  const rows = rentBookRows(a);
  expect(rows[0]).toMatchObject({ status: "Paid", remaining: 0 });
  expect(rows[1]).toMatchObject({ status: "Part paid", paid: 5000, remaining: 5000 });
  expect(rows[2]).toMatchObject({ status: "Unpaid", remaining: 10000 });
  expect(rows[4]).toMatchObject({ status: "Paid", from: "2026-11-03" });
  expect(rows[5].status).toBe("Upcoming");
});
it("requires supplemental rent increases to be paid before ticking the period", () => {
  const a = account(); a.charges = projectCharges(a, "2026-10-06"); const base = a.charges[0];
  a.charges.push({ ...base, id: "increase", baseChargeId: base.id, periodStart: "2026-10-09", amountPence: 2000 });
  a.payments = [receipt(base.id, 10000)];
  expect(rentBookRows(a)[0]).toMatchObject({ amount: 12000, remaining: 2000, status: "Part paid", from: "2026-10-06" });
  a.payments.push({ ...receipt("increase", 2000), id: "topup" });
  expect(rentBookRows(a)[0].status).toBe("Paid");
});
it("removes ticks for reversed payments and excludes services and unknown historical coverage", () => {
  const a = account(); a.charges = projectCharges(a, "2026-10-06");
  a.payments = [{ ...receipt(a.charges[0].id, 10000), reversedAt: "2026-11-02" }];
  a.charges.push({ ...a.charges[0], id: "service", category: "service" }, { ...a.charges[0], id: "history", coverageKnown: false });
  const first = rentBookRows(a).filter(row => row.from === "2026-10-06");
  expect(first).toHaveLength(1); expect(first[0].status).toBe("Unpaid");
});
it("keeps monthly periods whole instead of inventing weekly liabilities", () => {
  const a = account(); a.schedules[0].frequency = "monthly"; a.schedules[0].dueDay = 6;
  const first = rentBookRows(a)[0];
  expect(first).toMatchObject({ from: "2026-10-06", to: "2026-11-05", amount: 10000 });
});
