import { randomUUID } from "node:crypto";
import { RentError } from "./errors";
import type { LedgerAccount } from "./types";

/** Applied to locked transaction copies; financial records are never deleted. */
export function prepareAccountArchive(accounts: LedgerAccount[], id: string, version: number, actor: string) {
  const account = accounts.find(a => a.id === id);
  if (!account) throw new RentError("Account not found.");
  if (account.archivedAt) return [];
  if (account.version !== version) throw new RentError("Account changed. Refresh and review before removing it.");
  if (account.payments.some(p => p.confirmation?.state === "sending")) throw new RentError("Wait for the pending payment confirmation before removing this account.");
  const at = new Date().toISOString();
  const before = { state: account.state, unitIds: [...account.unitIds], tenantGroupId: account.tenantGroupId };
  account.archivedAt = at;
  account.state = "paused";
  account.portalEnabled = false;
  delete account.portalToken;
  delete account.portalScope;
  for (const grant of account.portalGrants || []) if (!grant.revokedAt) grant.revokedAt = at;
  const changed = [account];
  // Removing the group's main account must not hide its other accounts.
  for (const child of accounts.filter(a => !a.archivedAt && a.tenantGroupId === id && a.id !== id)) {
    delete child.tenantGroupId;
    child.version++;
    child.audit.push({ id: randomUUID(), at, actor, type: "tenant_group_removed", detail: { previousTenantGroupId: id } });
    changed.push(child);
  }
  account.version++;
  account.audit.push({ id: randomUUID(), at, actor, type: "account_archived", detail: { before, historyPreserved: true, portalAccessRevoked: true } });
  return changed;
}
