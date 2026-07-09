alter table units
  add column if not exists tenant_access_token text,
  add column if not exists tenant_access_token_created_at timestamptz,
  add column if not exists tenant_access_enabled boolean not null default false;

update units
set tenant_access_token = encode(gen_random_bytes(32), 'hex'),
    tenant_access_token_created_at = now()
where tenant_access_token is null;

alter table units
  alter column tenant_access_token set not null,
  alter column tenant_access_token set default encode(gen_random_bytes(32), 'hex'),
  alter column tenant_access_token_created_at set not null,
  alter column tenant_access_token_created_at set default now();

create unique index if not exists idx_units_tenant_access_token
  on units (tenant_access_token);
