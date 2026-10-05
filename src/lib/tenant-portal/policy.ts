import { createHash, timingSafeEqual } from "node:crypto";
import type { Unit, Bill } from "../types";
import type { LedgerAccount, PortalGrant } from "../rent-ledger/types";

export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export function sameSecret(left: string, right: string) {
  return timingSafeEqual(Buffer.from(tokenHash(left)), Buffer.from(tokenHash(right)));
}
export function tenancyFingerprint(unit: Unit) {
  return tokenHash(JSON.stringify([unit.id, unit.estateId, unit.tenantName, unit.tenantContactName, unit.tenantEmail, unit.tenantMobile, unit.status, unit.tenantAccessEnabled, unit.tenantAccessToken]));
}
export function scopeIsCurrent(account: LedgerAccount, units: Unit[]) {
  const scope = account.portalScope;
  return !!scope && scope.length === account.unitIds.length && new Set(scope.map(s => s.unitId)).size === scope.length && scope.every(s => {
    const unit = units.find(u => u.id === s.unitId);
    return account.unitIds.includes(s.unitId) && !!unit && unit.status === "active" && s.tenancy === tenancyFingerprint(unit);
  });
}
export function grantIsCurrent(grant: PortalGrant, unit: Unit) {
  return !grant.revokedAt && unit.status === "active" && unit.tenantAccessEnabled && grant.unitId === unit.id && grant.tenancy === tenancyFingerprint(unit) && grant.tokenHash === tokenHash(unit.tenantAccessToken);
}
export function authorisedBills(account: LedgerAccount, units: Unit[], bills: Bill[]) {
  return bills.filter(b => !!b.issuedAt && account.portalGrants?.some(g => {
    const unit = units.find(u => u.id === g.unitId);
    // Existing history is explicitly approved. Newly issued bills follow this tenancy only.
    return !!unit && grantIsCurrent(g, unit) && b.unitId === g.unitId && (g.billIds.includes(b.id) || (b.createdAt > g.linkedAt && b.issuedAt! > g.linkedAt));
  }));
}
export type PortalPrincipal = { accountId: string; method: "private_link"; credentialHash: string };
// Future verified-phone sessions can resolve the same account-scoped principal.
export function resolvePrincipal(token: string, accounts: LedgerAccount[], units: Unit[]): PortalPrincipal | undefined {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return undefined;
  const hash = tokenHash(token);
  const matching = accounts.filter(a => {
    if (!a.portalEnabled || !scopeIsCurrent(a, units)) return false;
    if (a.portalToken && sameSecret(a.portalToken, token)) return true;
    return a.portalGrants?.some(g => {
      const u = units.find(u => u.id === g.unitId);
      return g.tokenHash === hash && !!u && grantIsCurrent(g, u);
    });
  });
  if (matching.length !== 1) return undefined;
  const account = matching[0];
  // Any overlapping account membership is ambiguous, even if one grant was approved.
  if (accounts.some(a => a.id !== account.id && a.unitIds.some(id => account.unitIds.includes(id)))) return undefined;
  return { accountId: account.id, method: "private_link", credentialHash: hash };
}
