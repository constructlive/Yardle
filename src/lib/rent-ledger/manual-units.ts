import type { LedgerAccount } from "./types";

/** Only imported, unconfirmed drafts may have their inferred assignments released. */
export function releaseUnconfirmedUnits(account: LedgerAccount): string[] {
  const snapshot = account.migration.snapshot as { units?: unknown[] } | null;
  if (account.state !== "review" || account.approval || account.portalEnabled || account.portalScope ||
      account.charges.length || account.payments.length || account.adjustments.length ||
      !Array.isArray(snapshot?.units) || !account.unitIds.length ||
      account.audit.some(e => e.type === "unit_membership_changed")) return [];
  const before = [...account.unitIds];
  account.unitIds = [];
  return before;
}
