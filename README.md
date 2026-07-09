# Yardle

Yardle is a standalone tablet-first estate management and electricity billing application built for one industrial estate. It replaces spreadsheet billing with unit and tenant management, meter reading entry, bill review, simulated bill issue/SMS logging, tenant bill views, payments, reporting, and import placeholders.

## Stack

- Next.js, React, TypeScript
- Tailwind CSS
- PostgreSQL SQL schema in `database/schema.sql`
- Role-based admin authentication scaffolding for around 3 administrators
- Mock SMS provider with interfaces for Twilio, Vonage, and Textlocal
- PDF-ready bill HTML generator

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Demo access

Use the role switcher in the header:

- Super Admin: full admin portal
- Estate Admin: admin portal
- Tenants: secure passwordless bill links scoped to one business

When `DATABASE_URL` is not set, Yardle runs in local Demo Mode using the bundled `src/lib/demo-data.ts` data through an in-memory store. The admin header shows a small Demo Mode badge, and local preview pages load without PostgreSQL. Demo Mode changes last for the current dev server session only.

When `DATABASE_URL` is set, Yardle uses PostgreSQL for persistent app data. Demo data is seed data only and is inserted into an empty database on first load.

## Database

Create a PostgreSQL database and run:

```bash
psql "$DATABASE_URL" -f database/schema.sql
```

Money is stored as integer pence in the schema and app utilities.

## Environment

Copy `.env.example` to `.env.local` and fill in provider credentials as needed. `SMS_PROVIDER=mock` logs simulated SMS messages for local development.

## MVP scope

Implemented pages:

- Admin dashboard
- Units
- Meter readings
- Billing periods
- Bill review and issue flow
- Bills
- Payments
- Reports and CSV export
- SMS logs
- Settings
- Passwordless online bill access
- CSV import placeholder

Next production steps are hardening auth/session handling, adding server-side PDF rendering/storage and a real SMS/email provider adapter.

## Persistent database

Set `DATABASE_URL` in `.env.local`, run `database/schema.sql`, then start the app. On first load the app seeds the existing demo estate, units, readings, bills, payments, and SMS logs into an empty database. After that, pages read and write PostgreSQL data instead of using demo arrays.

Implemented persistent writes include units/tenants, meter readings, billing periods, bill issuing, payments, landlord payment updates, SMS logs, and estate settings.








## Secure bill links

Tenants view bills through /bill/[token] without logging in. Existing PostgreSQL databases must run database/migrations/001_tenant_bill_access.sql once. Set NEXT_PUBLIC_APP_URL (or APP_URL) in production so SMS and email links use the public Yardle address. Demo mode includes stable secure tokens and supports link regeneration in memory.


