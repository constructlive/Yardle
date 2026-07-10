import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

export type DbRow = RowDataPacket & Record<string, unknown>;
export type QueryResult<T extends Record<string, unknown> = DbRow> = {
  rows: T[];
  insertId?: number;
  affectedRows?: number;
};

export type DbClient = {
  query<T extends Record<string, unknown> = DbRow>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
};

let pool: Pool | undefined;
let schemaChecked = false;

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER));
}

function getDatabaseConfig() {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
      connectionLimit: 10,
      charset: "utf8mb4_unicode_ci",
      timezone: "Z"
    };
  }

  return {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 10,
    charset: "utf8mb4_unicode_ci",
    timezone: "Z"
  };
}

export function getPool() {
  if (!hasDatabaseUrl()) {
    throw new Error("DATABASE_URL or DB_HOST/DB_NAME/DB_USER is required for MariaDB. Leave it unset to use Demo Mode locally.");
  }
  if (!pool) {
    pool = mysql.createPool(getDatabaseConfig());
  }
  return pool;
}

export async function closePool() {
  if (!pool) {
    return;
  }
  await pool.end();
  pool = undefined;
  schemaChecked = false;
}

function wrapResult<T extends Record<string, unknown>>(result: unknown): QueryResult<T> {
  if (Array.isArray(result)) {
    return { rows: result as T[] };
  }
  const header = result as ResultSetHeader;
  return { rows: [], insertId: header.insertId, affectedRows: header.affectedRows };
}

export async function query<T extends Record<string, unknown> = DbRow>(sql: string, params: unknown[] = []) {
  const [result] = await getPool().execute(sql, params as any[]);
  return wrapResult<T>(result);
}

function createClient(connection: PoolConnection): DbClient {
  return {
    async query<T extends Record<string, unknown> = DbRow>(sql: string, params: unknown[] = []) {
      const [result] = await connection.execute(sql, params as any[]);
      return wrapResult<T>(result);
    }
  };
}

export async function transaction<T>(work: (client: DbClient) => Promise<T>) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(createClient(connection));
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function ensureSeeded() {
  if (!hasDatabaseUrl() || schemaChecked) {
    return;
  }

  const database = getPool();
  await database.execute(`alter table units
    add column if not exists tenant_access_token varchar(128),
    add column if not exists tenant_access_token_created_at datetime default current_timestamp,
    add column if not exists tenant_access_enabled tinyint(1) not null default 0`);
  await database.execute(`update units
    set tenant_access_token = lower(hex(random_bytes(32))),
        tenant_access_token_created_at = coalesce(tenant_access_token_created_at, utc_timestamp())
    where tenant_access_token is null or tenant_access_token_created_at is null`);
  await database.execute(`alter table units
    modify tenant_access_token varchar(128) not null,
    modify tenant_access_token_created_at datetime not null default current_timestamp,
    modify tenant_access_enabled tinyint(1) not null default 0`);
  await database.execute(`create unique index if not exists idx_units_tenant_access_token on units (tenant_access_token)`);
  schemaChecked = true;
}