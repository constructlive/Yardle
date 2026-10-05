import { RentError } from "./errors";
import { randomUUID } from "node:crypto";
import { ensureSeeded, hasDatabaseUrl, query, transaction } from "../db";
import { getAppData } from "../data";
import { migrationDrafts } from "./migrate";
import { projectCharges, today } from "./engine";
import type { LedgerAccount } from "./types";

export const ledgerSchema = [
  `create table if not exists rent_ledger_accounts (id varchar(191) primary key, version int not null, state_json longtext not null, updated_at datetime not null default current_timestamp on update current_timestamp) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci`,
  `create table if not exists rent_ledger_events (id char(36) primary key, account_id varchar(191) not null, actor varchar(191) not null, event_type varchar(64) not null, detail_json longtext not null, created_at datetime not null default current_timestamp, index idx_rent_event_account (account_id, created_at), foreign key (account_id) references rent_ledger_accounts(id)) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci`,
  `create table if not exists rent_ledger_meta (id varchar(64) primary key, value_json longtext not null) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci`
];
type Runtime = { memory: Map<string, LedgerAccount>; initialized: boolean; initializing?: Promise<void>; serial: Promise<void> };
// Next can load server actions and pages in separate bundles in one process.
// Demo state and initialization must be shared across those module instances.
const globalState = globalThis as typeof globalThis & { yardleRentLedgerRuntime?: Runtime };
const state: Runtime = globalState.yardleRentLedgerRuntime ??= { memory: new Map<string, LedgerAccount>(), initialized: false, serial: Promise.resolve() };
const memory = state.memory;
export function audit(account: LedgerAccount, actor: string, type: string, detail: unknown) { account.audit.push({ id: randomUUID(), at: new Date().toISOString(), actor, type, detail }); }
export async function initializeLedger() {
  if (state.initialized) return;
  if (state.initializing) return state.initializing;
  state.initializing = (async () => {
    await ensureSeeded();
    if (hasDatabaseUrl()) {
      for (const sql of ledgerSchema) await query(sql);
      const existing = await query("select id from rent_ledger_meta where id='migration-v1'");
      if (existing.rows.length) { state.initialized = true; return; }
    }
    const drafts = migrationDrafts(await getAppData());
    if (!hasDatabaseUrl()) { for (const a of drafts) { audit(a, "migration", "legacy_snapshot", a.migration); memory.set(a.id, a); } }
    else await transaction(async client => {
      // One transaction owns migration. A competing worker waits on the unique metadata row.
      const claimed = await client.query("insert ignore into rent_ledger_meta (id,value_json) values ('migration-v1',?)", [JSON.stringify({ at: new Date().toISOString() })]);
      if (!claimed.affectedRows) return;
      for (const a of drafts) {
        audit(a, "migration", "legacy_snapshot", a.migration);
        await client.query("insert into rent_ledger_accounts (id,version,state_json) values (?,?,?)", [a.id, a.version, JSON.stringify(a)]);
        const event = a.audit[0];
        await client.query("insert into rent_ledger_events (id,account_id,actor,event_type,detail_json) values (?,?,?,?,?)", [event.id, a.id, event.actor, event.type, JSON.stringify(event)]);
      }
    });
    state.initialized = true;
  })();
  try { await state.initializing; } finally { state.initializing = undefined; }
}
export async function readAccounts() {
  await initializeLedger();
  if (!hasDatabaseUrl()) return [...memory.values()].map(a => structuredClone(a));
  const result = await query<{ state_json: string }>("select state_json from rent_ledger_accounts order by id");
  return result.rows.map(r => JSON.parse(r.state_json) as LedgerAccount);
}
/** Account aggregate is locked for every mutation; events append in the same transaction. */
export async function mutateAccount<T>(id: string, change: (account: LedgerAccount) => T, expectedVersion?: number): Promise<T> {
  await initializeLedger();
  const apply = (a: LedgerAccount) => { if (expectedVersion !== undefined && a.version !== expectedVersion) throw new RentError("This account changed. Refresh and review the preview again."); return change(a); };
  if (!hasDatabaseUrl()) {
    let release!: () => void; const previous = state.serial; state.serial = new Promise<void>(r => { release = r; }); await previous;
    try { const stored = memory.get(id); if (!stored) throw new RentError("Account not found."); const a = structuredClone(stored); const before = JSON.stringify(a); const result = apply(a); if (before !== JSON.stringify(a)) { a.version++; memory.set(id, a); } return result; } finally { release(); }
  }
  return transaction(async client => {
    const rows = await client.query<{ state_json: string }>("select state_json from rent_ledger_accounts where id=? for update", [id]);
    if (!rows.rows[0]) throw new RentError("Account not found.");
    const a: LedgerAccount = JSON.parse(rows.rows[0].state_json); const before = JSON.stringify(a); const eventCount = a.audit.length;
    const result = apply(a);
    if (before !== JSON.stringify(a)) {
      a.version++;
      await client.query("update rent_ledger_accounts set version=?,state_json=? where id=?", [a.version, JSON.stringify(a), id]);
      for (const event of a.audit.slice(eventCount)) await client.query("insert into rent_ledger_events (id,account_id,actor,event_type,detail_json) values (?,?,?,?,?)", [event.id, id, event.actor, event.type, JSON.stringify(event)]);
    }
    return result;
  });
}
export function catchUpAccount(account: LedgerAccount, asOf = today()) {
  if (account.state !== "active") return 0;
  const existing = new Set(account.charges.map(c => c.id));
  const charges = projectCharges(account, asOf).filter(c => c.dueDate <= asOf && !existing.has(c.id));
  if (charges.length) { account.charges.push(...charges); audit(account, "scheduler", "charges_created", charges); }
  return charges.length;
}
export async function catchUpAll() {
  const accounts = await readAccounts(); let created = 0;
  for (const a of accounts) if (a.state === "active") created += await mutateAccount(a.id, account => catchUpAccount(account));
  return created;
}
export async function getLedgerAccounts() { await catchUpAll(); return readAccounts(); }
export async function getPortalAccount(token: string) {
  const { getTenantPortal } = await import("../tenant-portal/access");
  return (await getTenantPortal(token))?.account;
}
export async function createAccount(account: LedgerAccount) {
  await initializeLedger();
  if (!hasDatabaseUrl()) { if (memory.has(account.id)) throw new RentError("Account already exists."); memory.set(account.id, structuredClone(account)); return; }
  await transaction(async client => {
    await client.query("insert into rent_ledger_accounts (id,version,state_json) values (?,?,?)", [account.id, account.version, JSON.stringify(account)]);
    for (const event of account.audit) await client.query("insert into rent_ledger_events (id,account_id,actor,event_type,detail_json) values (?,?,?,?,?)", [event.id, account.id, event.actor, event.type, JSON.stringify(event)]);
  });
}

export async function setUnitMembership(id: string, unitIds: string[], expectedVersion: number, actor: string, reason: string) {
  await initializeLedger();
  const apply = (accounts: LedgerAccount[]) => {
    const a = accounts.find(a => a.id === id); if (!a || a.version !== expectedVersion) throw new RentError("Account changed. Refresh and review again.");
    if (accounts.some(other => other.id !== id && other.unitIds.some(u => unitIds.includes(u)))) throw new RentError("A selected unit already belongs to another account. Remove its old link first.");
    const before = [...a.unitIds]; a.unitIds = [...new Set(unitIds)]; a.version++; audit(a, actor, "unit_membership_changed", { before, after: a.unitIds, reason }); return a;
  };
  if (!hasDatabaseUrl()) {
    let release!: () => void; const previous = state.serial; state.serial = new Promise<void>(r => { release = r; }); await previous;
    try { const a = apply([...memory.values()].map(a => structuredClone(a))); memory.set(id, a); } finally { release(); } return;
  }
  await transaction(async client => {
    await client.query("select id from rent_ledger_meta where id='migration-v1' for update");
    const rows = await client.query<{ state_json: string }>("select state_json from rent_ledger_accounts order by id for update");
    const a = apply(rows.rows.map(r => JSON.parse(r.state_json))); const event = a.audit.at(-1)!;
    await client.query("update rent_ledger_accounts set version=?,state_json=? where id=?", [a.version, JSON.stringify(a), id]);
    await client.query("insert into rent_ledger_events (id,account_id,actor,event_type,detail_json) values (?,?,?,?,?)", [event.id, id, event.actor, event.type, JSON.stringify(event)]);
  });
}
