"use server";
import * as ledger from "./actions";
import { RentError, type ActionResult } from "./errors";
async function safely<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try { return { ok: true, value: await work() }; }
  catch (error) {
    // Framework navigation exceptions must retain their redirect behaviour.
    if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
    if (error instanceof RentError || (error instanceof Error && error.name === "RentError")) return { ok: false, error: error.message };
    console.error("Rent action failed", error);
    return { ok: false, error: "Unable to complete this action. Refresh the account to check whether it saved before retrying." };
  }
}
export async function saveAccountDetails(...args: Parameters<typeof ledger.saveAccountDetails>) { return safely(() => ledger.saveAccountDetails(...args)); }
export async function saveAccountUnits(...args: Parameters<typeof ledger.saveAccountUnits>) { return safely(() => ledger.saveAccountUnits(...args)); }
export async function saveSchedule(...args: Parameters<typeof ledger.saveSchedule>) { return safely(() => ledger.saveSchedule(...args)); }
export async function addRate(...args: Parameters<typeof ledger.addRate>) { return safely(() => ledger.addRate(...args)); }
export async function previewReconciliation(...args: Parameters<typeof ledger.previewReconciliation>) { return safely(() => ledger.previewReconciliation(...args)); }
export async function approveReconciliation(...args: Parameters<typeof ledger.approveReconciliation>) { return safely(() => ledger.approveReconciliation(...args)); }
export async function previewReceipt(...args: Parameters<typeof ledger.previewReceipt>) { return safely(() => ledger.previewReceipt(...args)); }
export async function recordReceipt(...args: Parameters<typeof ledger.recordReceipt>) { return safely(() => ledger.recordReceipt(...args)); }
export async function reverseReceipt(...args: Parameters<typeof ledger.reverseReceipt>) { return safely(() => ledger.reverseReceipt(...args)); }
export async function sendReceiptConfirmation(...args: Parameters<typeof ledger.sendReceiptConfirmation>) { return safely(() => ledger.sendReceiptConfirmation(...args)); }
export async function addAdjustment(...args: Parameters<typeof ledger.addAdjustment>) { return safely(() => ledger.addAdjustment(...args)); }
export async function setAccountState(...args: Parameters<typeof ledger.setAccountState>) { return safely(() => ledger.setAccountState(...args)); }
export async function addManualCharge(...args: Parameters<typeof ledger.addManualCharge>) { return safely(() => ledger.addManualCharge(...args)); }
export async function enablePortal(...args: Parameters<typeof ledger.enablePortal>) { return safely(() => ledger.enablePortal(...args)); }
export async function previewCredit(...args: Parameters<typeof ledger.previewCredit>) { return safely(() => ledger.previewCredit(...args)); }
export async function allocateCredit(...args: Parameters<typeof ledger.allocateCredit>) { return safely(() => ledger.allocateCredit(...args)); }

export async function createUnitRent(...args: Parameters<typeof ledger.createUnitRent>) { return safely(() => ledger.createUnitRent(...args)); }

export async function linkExistingRentAccount(...args: Parameters<typeof ledger.linkExistingRentAccount>) { return safely(() => ledger.linkExistingRentAccount(...args)); }

export async function removeRentAccount(...args: Parameters<typeof ledger.removeRentAccount>) { return safely(() => ledger.removeRentAccount(...args)); }
