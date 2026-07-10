set names utf8mb4;
set time_zone = '+00:00';

create table if not exists users (
  id char(36) primary key,
  name varchar(255) not null,
  email varchar(255) not null unique,
  mobile varchar(64),
  role varchar(32) not null,
  password_hash varchar(255),
  created_at datetime not null default current_timestamp,
  constraint chk_users_role check (role in ('super_admin', 'landlord_admin', 'admin', 'tenant'))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists estates (
  id char(36) primary key,
  name varchar(255) not null,
  address text not null,
  contact_email varchar(255) not null,
  contact_phone varchar(64),
  logo_url text,
  default_kwh_rate_pence int not null,
  default_standing_charge_pence int not null,
  default_levy_pence int not null default 0,
  currency varchar(8) not null default 'GBP',
  sms_sender_name varchar(64) not null default 'Yardle',
  created_at datetime not null default current_timestamp
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists units (
  id char(36) primary key,
  estate_id char(36) not null,
  unit_reference varchar(64) not null,
  tenant_name varchar(255),
  tenant_contact_name varchar(255),
  tenant_email varchar(255),
  tenant_mobile varchar(64),
  status varchar(32) not null default 'active',
  notes text,
  free_supply_meter tinyint(1) not null default 0,
  custom_kwh_rate_pence int,
  custom_standing_charge_pence int,
  opening_balance_pence int not null default 0,
  current_balance_pence int not null default 0,
  tenant_access_token varchar(128) not null,
  tenant_access_token_created_at datetime not null default current_timestamp,
  tenant_access_enabled tinyint(1) not null default 0,
  created_at datetime not null default current_timestamp,
  unique key uq_units_estate_reference (estate_id, unit_reference),
  unique key uq_units_tenant_access_token (tenant_access_token),
  constraint fk_units_estate foreign key (estate_id) references estates(id) on delete cascade,
  constraint chk_units_status check (status in ('active', 'inactive', 'empty', 'not_used'))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists billing_periods (
  id char(36) primary key,
  estate_id char(36) not null,
  name varchar(255) not null,
  start_date date not null,
  end_date date not null,
  status varchar(32) not null default 'draft',
  kwh_rate_pence int not null,
  standing_charge_pence int not null,
  levy_pence int not null default 0,
  created_by char(36),
  issued_at datetime,
  created_at datetime not null default current_timestamp,
  constraint fk_billing_periods_estate foreign key (estate_id) references estates(id) on delete cascade,
  constraint fk_billing_periods_created_by foreign key (created_by) references users(id) on delete set null,
  constraint chk_billing_periods_status check (status in ('draft', 'review', 'issued', 'locked'))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists meter_readings (
  id char(36) primary key,
  billing_period_id char(36) not null,
  unit_id char(36) not null,
  previous_reading decimal(12,2) not null,
  current_reading decimal(12,2) not null,
  `usage` decimal(12,2) not null,
  is_estimated tinyint(1) not null default 0,
  reading_notes text,
  reading_status varchar(32) not null default 'draft',
  entered_by char(36),
  entered_at datetime not null default current_timestamp,
  photo_url text,
  unique key uq_meter_readings_period_unit (billing_period_id, unit_id),
  constraint fk_meter_readings_period foreign key (billing_period_id) references billing_periods(id) on delete cascade,
  constraint fk_meter_readings_unit foreign key (unit_id) references units(id) on delete cascade,
  constraint fk_meter_readings_entered_by foreign key (entered_by) references users(id) on delete set null,
  constraint chk_meter_readings_status check (reading_status in ('draft', 'confirmed', 'billed'))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists bills (
  id char(36) primary key,
  billing_period_id char(36) not null,
  unit_id char(36) not null,
  previous_reading decimal(12,2) not null,
  current_reading decimal(12,2) not null,
  `usage` decimal(12,2) not null,
  kwh_rate_pence int not null,
  standing_charge_pence int not null,
  levy_pence int not null default 0,
  usage_cost_pence int not null,
  subtotal_pence int not null,
  outstanding_carried_forward_pence int not null default 0,
  total_due_pence int not null,
  rounded_total_pence int not null,
  amount_paid_pence int not null default 0,
  remaining_balance_pence int not null,
  paid_status varchar(32) not null default 'unpaid',
  payment_date date,
  admin_notes text,
  tenant_notes text,
  pdf_url text,
  issued_at datetime,
  sms_sent_at datetime,
  created_at datetime not null default current_timestamp,
  unique key uq_bills_period_unit (billing_period_id, unit_id),
  constraint fk_bills_period foreign key (billing_period_id) references billing_periods(id) on delete cascade,
  constraint fk_bills_unit foreign key (unit_id) references units(id) on delete cascade,
  constraint chk_bills_paid_status check (paid_status in ('unpaid', 'part_paid', 'paid', 'credited'))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists payments (
  id char(36) primary key,
  bill_id char(36) not null,
  unit_id char(36) not null,
  amount_pence int not null,
  payment_method varchar(32) not null,
  payment_date date not null,
  notes text,
  recorded_by char(36),
  created_at datetime not null default current_timestamp,
  constraint fk_payments_bill foreign key (bill_id) references bills(id) on delete cascade,
  constraint fk_payments_unit foreign key (unit_id) references units(id) on delete cascade,
  constraint fk_payments_recorded_by foreign key (recorded_by) references users(id) on delete set null,
  constraint chk_payments_amount check (amount_pence > 0),
  constraint chk_payments_method check (payment_method in ('cash', 'bank_transfer', 'card', 'other'))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists sms_logs (
  id char(36) primary key,
  bill_id char(36),
  unit_id char(36),
  mobile varchar(64) not null,
  message text not null,
  status varchar(32) not null,
  provider varchar(64) not null,
  provider_reference varchar(255),
  failure_reason text,
  sent_at datetime,
  created_at datetime not null default current_timestamp,
  constraint fk_sms_logs_bill foreign key (bill_id) references bills(id) on delete set null,
  constraint fk_sms_logs_unit foreign key (unit_id) references units(id) on delete set null,
  constraint chk_sms_logs_status check (status in ('queued', 'sent', 'failed', 'simulated'))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists settings (
  id char(36) primary key,
  setting_key varchar(128) not null unique,
  setting_value json,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create index idx_users_email on users (email);
create index idx_units_estate_status on units (estate_id, status);
create index idx_units_reference on units (unit_reference);
create index idx_units_tenant_email on units (tenant_email);
create index idx_units_tenant_mobile on units (tenant_mobile);
create index idx_billing_periods_estate_status on billing_periods (estate_id, status);
create index idx_meter_readings_period_unit on meter_readings (billing_period_id, unit_id);
create index idx_bills_period_status on bills (billing_period_id, paid_status);
create index idx_bills_unit_issued on bills (unit_id, issued_at);
create index idx_payments_unit_date on payments (unit_id, payment_date);
create index idx_payments_bill on payments (bill_id);
create index idx_sms_logs_created_at on sms_logs (created_at);