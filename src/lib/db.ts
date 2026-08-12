import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { DEFAULT_SMS_TEMPLATES } from "./sms-template-definitions";

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
  await database.execute(`alter table payments add column if not exists reversed_at datetime after recorded_by, add column if not exists reversed_by char(36) after reversed_at, add column if not exists reversal_reason text after reversed_by`);
  await database.execute(`create index if not exists idx_payments_bill_active on payments (bill_id, reversed_at)`);
  await database.execute(`alter table sms_logs add column if not exists failure_reason text after provider_reference`);
  await database.execute(`create table if not exists sms_templates (
    id char(36) primary key,
    template_key varchar(64) not null unique,
    display_name varchar(255) not null,
    body text not null,
    created_at datetime not null default current_timestamp,
    updated_at datetime not null default current_timestamp on update current_timestamp
  ) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci`);
  for (const template of DEFAULT_SMS_TEMPLATES) {
    await database.execute(
      `insert into sms_templates (id, template_key, display_name, body) values (?,?,?,?)
       on duplicate key update display_name=values(display_name)`,
      [template.id, template.key, template.displayName, template.body]
    );
  }
  await database.execute(`create table if not exists historical_import_batches (
    id char(36) primary key,
    estate_id char(36) not null,
    filenames text not null,
    uploaded_by char(36),
    uploaded_at datetime not null default current_timestamp,
    total_rows int not null default 0,
    imported_rows int not null default 0,
    skipped_rows int not null default 0,
    failed_rows int not null default 0,
    status varchar(32) not null default 'preview',
    created_at datetime not null default current_timestamp
  ) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci`);
  await database.execute(`create table if not exists historical_bills (
    id char(36) primary key,
    import_batch_id char(36) not null,
    estate_id char(36) not null,
    unit_id char(36) not null,
    billing_period_start date not null,
    billing_period_end date not null,
    source_filename text not null,
    source_row_number int not null,
    imported_unit_reference varchar(64) not null,
    matched_unit_reference varchar(64) not null,
    historical_tenant_name varchar(255),
    previous_reading decimal(12,2),
    current_reading decimal(12,2),
    units_used decimal(12,2),
    unit_rate_pence int,
    levy_pence int,
    standing_charge_pence int,
    usage_charge_pence int,
    subtotal_pence int,
    outstanding_balance_pence int,
    total_due_pence int,
    paid_status varchar(32) not null default 'unpaid',
    notes text,
    occupancy_snapshot varchar(32),
    source_payload json,
    imported_at datetime not null default current_timestamp,
    created_at datetime not null default current_timestamp,
    unique key uq_historical_bill_estate_unit_period (estate_id, unit_id, billing_period_start, billing_period_end)
  ) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci`);
  await database.execute(`create index if not exists idx_historical_bills_unit_period on historical_bills (unit_id, billing_period_start, billing_period_end)`);
  await database.execute(`create index if not exists idx_historical_import_batches_uploaded on historical_import_batches (uploaded_at)`);
  await database.execute(`create unique index if not exists idx_units_tenant_access_token on units (tenant_access_token)`);
  await database.execute(`create table if not exists rent_settings (
    id char(36) primary key,
    unit_id char(36) not null unique,
    enabled tinyint(1) not null default 0,
    frequency varchar(32) not null default 'weekly_monday',
    amount_pence int not null default 0,
    opening_balance_pence int not null default 0,
    start_date date,
    due_day_of_month int,
    notes text,
    created_at datetime not null default current_timestamp,
    updated_at datetime not null default current_timestamp on update current_timestamp,
    constraint fk_rent_settings_unit foreign key (unit_id) references units(id) on delete cascade,
    constraint chk_rent_settings_frequency check (frequency in ('weekly_monday', 'calendar_month', 'manual'))
  ) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci`);
  await database.execute(`alter table rent_settings add column if not exists opening_balance_pence int not null default 0 after amount_pence`);
  await database.execute(`create table if not exists rent_charges (
    id char(36) primary key,
    unit_id char(36) not null,
    due_date date not null,
    amount_pence int not null,
    status varchar(32) not null default 'due',
    notes text,
    created_at datetime not null default current_timestamp,
    unique key uq_rent_charges_unit_due (unit_id, due_date),
    constraint fk_rent_charges_unit foreign key (unit_id) references units(id) on delete cascade,
    constraint chk_rent_charges_status check (status in ('due', 'paid', 'credited', 'cancelled'))
  ) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci`);
  await database.execute(`create table if not exists rent_payments (
    id char(36) primary key,
    unit_id char(36) not null,
    amount_pence int not null,
    payment_method varchar(32) not null,
    payment_date date not null,
    notes text,
    recorded_by char(36),
    reversed_at datetime,
    reversed_by char(36),
    reversal_reason text,
    created_at datetime not null default current_timestamp,
    constraint fk_rent_payments_unit foreign key (unit_id) references units(id) on delete cascade,
    constraint fk_rent_payments_recorded_by foreign key (recorded_by) references users(id) on delete set null,
    constraint chk_rent_payments_amount check (amount_pence > 0),
    constraint chk_rent_payments_method check (payment_method in ('cash', 'bank_transfer', 'card', 'other'))
  ) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci`);
  await database.execute(`create index if not exists idx_rent_charges_unit_due on rent_charges (unit_id, due_date)`);
  await database.execute(`create index if not exists idx_rent_payments_unit_date on rent_payments (unit_id, payment_date)`);
  schemaChecked = true;
}