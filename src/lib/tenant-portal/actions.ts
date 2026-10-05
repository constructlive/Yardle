"use server";
import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "../session";
import { getAppData } from "../data";
import { audit, mutateAccount, readAccounts } from "../rent-ledger/store";
import { RentError, type ActionResult } from "../rent-ledger/errors";
import { authorisedBills, resolvePrincipal, tenancyFingerprint, tokenHash } from "./policy";
import { getTenantPortal } from "./access";
import { addQuery, queryStatuses, replyToQuery } from "./queries";
import type { TenantQuery } from "../rent-ledger/types";

async function safely(work: () => Promise<void>): Promise<ActionResult<void>> {
  try { await work(); return { ok: true, value: undefined }; }
  catch (e) { if (e instanceof RentError) return { ok: false, error: e.message }; console.error("Tenant portal action failed", e instanceof Error ? e.name : "unknown"); return { ok: false, error: "Unable to save. Refresh and check the conversation before retrying." }; }
}
const value = (f: FormData, key: string) => String(f.get(key) || "");
function refresh() { revalidatePath("/admin", "layout"); revalidatePath("/account", "layout"); revalidatePath("/rent", "layout"); }

export async function savePortalAccess(f: FormData) {
  return safely(async () => {
    const user = await requireAdminSession(); const data = await getAppData(); const accounts = await readAccounts();
    const id = value(f, "accountId"); const enabled = f.get("enabled") === "on";
    await mutateAccount(id, a => {
      if (enabled && f.get("confirmed") !== "on") throw new RentError("Confirm the tenant identity, account membership and private-link warning.");
      if (enabled && accounts.some(other => other.id !== id && other.unitIds.some(u => a.unitIds.includes(u)))) throw new RentError("Unit membership is ambiguous. Resolve the linked accounts first.");
      const units = a.unitIds.map(id => data.units.find(u => u.id === id));
      if (enabled && units.some(u => !u || u.status !== "active")) throw new RentError("Only current active tenancies can have portal access.");
      const scope = units.filter(u => !!u).map(u => ({ unitId: u!.id, tenancy: tenancyFingerprint(u!) }));
      const scopeChanged = JSON.stringify(scope) !== JSON.stringify(a.portalScope);
      if (!enabled || !a.portalEnabled || !a.portalToken || f.get("regenerate") === "on" || scopeChanged) {
        a.portalToken = randomBytes(32).toString("hex");
        for (const g of a.portalGrants || []) if (!g.revokedAt) g.revokedAt = new Date().toISOString();
      }
      a.portalEnabled = enabled; a.portalScope = enabled ? scope : undefined;
      audit(a, user.userId, "portal_access_changed", { enabled, replaced: f.get("regenerate") === "on", scopeChanged });
    }, Number(value(f, "version"))); refresh();
  });
}

export async function linkElectricityAccess(f: FormData) {
  return safely(async () => {
    const user = await requireAdminSession(); const data = await getAppData(); const accounts = await readAccounts();
    const unit = data.units.find(u => u.id === value(f, "unitId")); const id = value(f, "accountId");
    if (!unit || !unit.tenantAccessEnabled || unit.status !== "active" || unit.tenantAccessToken.length < 32) throw new RentError("Enable a secure bill link for this active unit first.");
    if (f.get("confirmed") !== "on") throw new RentError("Confirm the tenant, electricity balance and selected bill history.");
    const hash = tokenHash(unit.tenantAccessToken); const tenancy = tenancyFingerprint(unit);
    if (accounts.some(a => a.portalGrants?.some(g => g.tokenHash === hash && (a.id !== id || g.tenancy !== tenancy || !!g.revokedAt)))) throw new RentError("This bill link was previously revoked or belonged to another tenancy. Replace it in Units / Tenants before linking it again.");
    const billIds = [...new Set(f.getAll("billIds").map(String))];
    if (billIds.some(bid => !data.bills.some(b => b.id === bid && b.unitId === unit.id && b.issuedAt))) throw new RentError("Invalid bill selection.");
    await mutateAccount(id, a => {
      if (!a.portalEnabled || !a.portalScope?.some(s => s.unitId === unit.id && s.tenancy === tenancy)) throw new RentError("Confirm portal access for the current tenancy first.");
      if (accounts.filter(other => other.unitIds.includes(unit.id)).length !== 1 || !a.unitIds.includes(unit.id)) throw new RentError("Link this unit to exactly one rent account first.");
      const existing = a.portalGrants?.find(g => g.tokenHash === hash && !g.revokedAt);
      if (existing) { existing.billIds = billIds; }
      else (a.portalGrants ??= []).push({ id: randomUUID(), unitId: unit.id, tokenHash: hash, tenancy, billIds, linkedAt: new Date().toISOString(), actor: user.userId });
      audit(a, user.userId, "electricity_portal_link_confirmed", { unitId: unit.id, billIds });
    }, Number(value(f, "version"))); refresh();
  });
}

export async function submitTenantQuery(token: string, input: { requestId: string; subject: string; text: string; targetType: TenantQuery["targetType"]; targetId: string }) {
  return safely(async () => {
    const portal = await getTenantPortal(token); if (!portal) throw new RentError("This private link has expired. Ask the office for a new link.");
    const data = await getAppData(); const accounts = await readAccounts();
    await mutateAccount(portal.principal.accountId, a => {
      if (resolvePrincipal(token, accounts.map(x => x.id === a.id ? a : x), data.units)?.accountId !== a.id) throw new RentError("Access expired.");
      const bills = authorisedBills(a, data.units, data.bills);
      const qid = addQuery(a, input, { bills: bills.map(b => b.id), payments: a.payments.filter(p => !p.legacyId).map(p => p.id), electricityPayments: data.payments.filter(p => bills.some(b => b.id === p.billId)).map(p => p.id) });
      audit(a, "tenant", "query_submitted", { queryId: qid });
    }); refresh();
  });
}

export async function updateTenantQuery(input: { token?: string; accountId?: string; queryId: string; operation: "reply" | "read" | "status"; text?: string; requestId?: string; status?: string; readCount?: number }) {
  return safely(async () => {
    const admin = input.token === undefined ? await requireAdminSession() : undefined;
    const portal = !admin && input.token ? await getTenantPortal(input.token) : undefined;
    const accountId = admin ? input.accountId : portal?.principal.accountId;
    if (!accountId) throw new RentError("Access expired.");
    const data = !admin ? await getAppData() : undefined; const accounts = !admin ? await readAccounts() : undefined;
    await mutateAccount(accountId, a => {
      if (!admin && resolvePrincipal(input.token!, accounts!.map(x => x.id === a.id ? a : x), data!.units)?.accountId !== a.id) throw new RentError("Access expired.");
      const q = a.tenantQueries?.find(q => q.id === input.queryId); if (!q) throw new RentError("Query not found.");
      const author = admin ? "admin" : "tenant";
      if (input.operation === "read") {
        const count = input.readCount; if (!Number.isInteger(count) || count! < 0 || count! > q.messages.length) throw new RentError("Refresh the conversation and try again.");
        if (admin) q.adminReadCount = Math.max(q.adminReadCount, count!); else q.tenantReadCount = Math.max(q.tenantReadCount, count!);
      } else if (input.operation === "reply") {
        if (!admin && (a.tenantQueries || []).flatMap(q => q.messages).filter(m => m.author === "tenant" && m.at.slice(0,10) === new Date().toISOString().slice(0,10)).length >= 50) throw new RentError("Daily message limit reached.");
        replyToQuery(q, author, input.text || "", input.requestId || "");
      } else if (input.operation === "status" && admin && queryStatuses.includes(input.status as typeof queryStatuses[number])) q.status = input.status as TenantQuery["status"];
      else throw new RentError("Action not allowed.");
      audit(a, admin?.userId || "tenant", `query_${input.operation}`, { queryId: q.id, status: q.status });
    }); refresh();
  });
}
