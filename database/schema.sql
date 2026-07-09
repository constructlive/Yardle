create extension if not exists pgcrypto;

create type user_role as enum ('super_admin', 'admin', 'tenant');
create type unit_status as enum ('active', 'inactive', 'empty', 'not_used');
create type billing_period_status as enum ('draft', 'review', 'issued', 'locked');
create type reading_status as enum ('draft', 'confirmed', 'billed');
create type paid_status as enum ('unpaid', 'part_paid', 'paid', 'credited');
create type payment_method as enum ('cash', 'bank_transfer', 'card', 'other');
create type sms_status as enum ('queued', 'sent', 'failed', 'simulated');

create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  mobile text,
  role user_role not null,
  created_at timestamptz not null default now()
);

create table estates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  contact_email text not null,
  contact_phone text,
  logo_url text,
  default_kwh_rate_pence integer not null,
  default_standing_charge_pence integer not null,
  default_levy_pence integer not null default 0,
  currency text not null default 'GBP',
  sms_sender_name text not null default 'Yardle',
  created_at timestamptz not null default now()
);

create table units (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references estates(id) on delete cascade,
  unit_reference text not null,
  tenant_name text,
  tenant_contact_name text,
  tenant_email text,
  tenant_mobile text,
  status unit_status not null default 'active',
  notes text,
  free_supply_meter boolean not null default false,
  custom_kwh_rate_pence integer,
  custom_standing_charge_pence integer,
  opening_balance_pence integer not null default 0,
  current_balance_pence integer not null default 0,
  tenant_access_token text not null default encode(gen_random_bytes(32), 'hex'),
  tenant_access_token_created_at timestamptz not null default now(),
  tenant_access_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (estate_id, unit_reference),
  unique (tenant_access_token)
);

create table billing_periods (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references estates(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  status billing_period_status not null default 'draft',
  kwh_rate_pence integer not null,
  standing_charge_pence integer not null,
  levy_pence integer not null default 0,
  created_by uuid references users(id),
  issued_at timestamptz,
  created_at timestamptz not null default now()
);

create table meter_readings (
  id uuid primary key default gen_random_uuid(),
  billing_period_id uuid not null references billing_periods(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  previous_reading numeric(12, 2) not null,
  current_reading numeric(12, 2) not null,
  usage numeric(12, 2) not null,
  is_estimated boolean not null default false,
  reading_notes text,
  reading_status reading_status not null default 'draft',
  entered_by uuid references users(id),
  entered_at timestamptz not null default now(),
  photo_url text,
  unique (billing_period_id, unit_id)
);

create table bills (
  id uuid primary key default gen_random_uuid(),
  billing_period_id uuid not null references billing_periods(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  previous_reading numeric(12, 2) not null,
  current_reading numeric(12, 2) not null,
  usage numeric(12, 2) not null,
  kwh_rate_pence integer not null,
  standing_charge_pence integer not null,
  levy_pence integer not null default 0,
  usage_cost_pence integer not null,
  subtotal_pence integer not null,
  outstanding_carried_forward_pence integer not null default 0,
  total_due_pence integer not null,
  rounded_total_pence integer not null,
  amount_paid_pence integer not null default 0,
  remaining_balance_pence integer not null,
  paid_status paid_status not null default 'unpaid',
  payment_date date,
  admin_notes text,
  tenant_notes text,
  pdf_url text,
  issued_at timestamptz,
  sms_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (billing_period_id, unit_id)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bills(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  amount_pence integer not null check (amount_pence > 0),
  payment_method payment_method not null,
  payment_date date not null,
  notes text,
  recorded_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table sms_logs (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid references bills(id) on delete set null,
  unit_id uuid references units(id) on delete set null,
  mobile text not null,
  message text not null,
  status sms_status not null,
  provider text not null,
  provider_reference text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_units_estate_status on units (estate_id, status);
create unique index idx_units_tenant_access_token on units (tenant_access_token);
create index idx_bills_unit on bills (unit_id, issued_at desc);
create index idx_payments_unit on payments (unit_id, payment_date desc);
create index idx_sms_logs_created_at on sms_logs (created_at desc);




