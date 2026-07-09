import { Pool, type QueryResultRow } from "pg";

let pool: Pool | undefined;
let seeded = false;

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool() {
  if (!hasDatabaseUrl()) {
    throw new Error("DATABASE_URL is required. Create a PostgreSQL database, run database/schema.sql, and set DATABASE_URL in .env.local.");
  }
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []) {
  return getPool().query<T>(text, params);
}

export async function transaction<T>(work: (client: import("pg").PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function ensureSeeded() {
  if (!hasDatabaseUrl() || seeded) {
    return;
  }
  const database = getPool();
  await database.query(`alter table units
    add column if not exists tenant_access_token text,
    add column if not exists tenant_access_token_created_at timestamptz default now(),
    add column if not exists tenant_access_enabled boolean not null default false`);
  await database.query(`update units set tenant_access_token = encode(gen_random_bytes(32), 'hex'), tenant_access_token_created_at = coalesce(tenant_access_token_created_at, now()) where tenant_access_token is null or tenant_access_token_created_at is null`);
  await database.query(`alter table units
    alter column tenant_access_token set not null,
    alter column tenant_access_token set default encode(gen_random_bytes(32), 'hex'),
    alter column tenant_access_token_created_at set not null,
    alter column tenant_access_token_created_at set default now()`);
  await database.query(`create unique index if not exists idx_units_tenant_access_token on units (tenant_access_token)`);
  const { seedDatabaseIfEmpty } = await import("./seed");
  await seedDatabaseIfEmpty();
  seeded = true;
}


