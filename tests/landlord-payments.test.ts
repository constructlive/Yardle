import { describe, expect, it } from "vitest";
import { compareUnitReferences } from "../src/lib/unit-sort";
import { paymentTotals, reversePaymentPreview } from "../src/lib/payment-accounting";
import type { Payment } from "../src/lib/types";

describe("unit reference natural sorting", () => {
  it("sorts numbered, suffixed, combined and text units naturally", () => {
    const input = ["FLAT 2", "11A", "10", "2/3", "BOB", "1", "20/21", "11", "FLAT 1", "C/WASH", "4"];
    expect(input.sort(compareUnitReferences)).toEqual(["1", "2/3", "4", "10", "11", "11A", "20/21", "BOB", "C/WASH", "FLAT 1", "FLAT 2"]);
  });
});

describe("payment accounting", () => {
  it("records full and partial payment totals", () => {
    expect(paymentTotals(10000, [payment("p1", 10000)])).toMatchObject({ amountPaidPence: 10000, remainingBalancePence: 0, paidStatus: "paid" });
    expect(paymentTotals(10000, [payment("p1", 2500)])).toMatchObject({ amountPaidPence: 2500, remainingBalancePence: 7500, paidStatus: "part_paid" });
  });

  it("reverses one payment while preserving other active payments", () => {
    const result = reversePaymentPreview(10000, [payment("p1", 3000), payment("p2", 2000)], "p1");
    expect(result).toMatchObject({ amountPaidPence: 2000, remainingBalancePence: 8000, paidStatus: "part_paid" });
  });

  it("prevents double reversal by ignoring already reversed payments", () => {
    const result = reversePaymentPreview(10000, [payment("p1", 3000, true)], "p1");
    expect(result).toBeUndefined();
    expect(paymentTotals(10000, [payment("p1", 3000, true)])).toMatchObject({ amountPaidPence: 0, remainingBalancePence: 10000, paidStatus: "unpaid" });
  });
});

function payment(id: string, amountPence: number, reversed = false): Payment {
  return { id, billId: "b1", unitId: "u1", amountPence, paymentMethod: "cash", paymentDate: "2026-07-10", recordedBy: "admin", reversedAt: reversed ? "2026-07-10T10:00:00.000Z" : undefined, createdAt: "2026-07-10T09:00:00.000Z" };
}