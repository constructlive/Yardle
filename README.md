# Yardle

Yardle is a standalone tablet-first estate management and electricity billing application built for one industrial estate. It replaces spreadsheet billing with unit and tenant management, meter reading entry, bill review, simulated bill issue/SMS logging, tenant bill views, payments, reporting, and import placeholders.

## Stack

- Next.js, React, TypeScript
- Tailwind CSS
- MariaDB/MySQL persistence through `mysql2`
- Role-based admin authentication scaffolding for around 3 administrators
- Mock SMS provider with interfaces for Twilio, Vonage, and Textlocal
- PDF-ready bill HTML generator

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

When `DATABASE_URL` is not set, Yardle runs in local Demo Mode using the bundled `src/lib/demo-data.ts` data through an in-memory store. The admin header shows a small Demo Mode badge, and local preview pages load without MariaDB. Demo Mode changes last for the current dev server session only.

When `DATABASE_URL` is set, Yardle uses MariaDB for persistent app data. Demo data is seed data only and is inserted only when `npm run db:seed` is run explicitly.

## Database

Create a MariaDB database and run:

```bash
npm run db:setup
```

Optional demo seed:

```bash
npm run db:seed
```

Create or update the first admin user:

```bash
npm run create-admin
```

See `database/README.md` for Plesk/MariaDB setup details. Money is stored as integer pence in the schema and app utilities.

## Environment

Copy `.env.example` to `.env.local` and fill in provider credentials as needed. Production uses a MariaDB URL such as:

```bash
DATABASE_URL=mysql://yardle_user:CHANGE_ME@127.0.0.1:3306/yardle
```

`SMS_PROVIDER=mock` logs simulated SMS messages for local development.

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

Next production steps are hardening database-backed auth/session handling, adding server-side PDF rendering/storage and a real SMS/email provider adapter.

## Persistent database

Set `DATABASE_URL` in `.env.local`, run `npm run db:setup`, then start the app. Pages read and write MariaDB data instead of using demo arrays. Persistent writes include units/tenants, meter readings, billing periods, bill issuing, payments, landlord payment updates, SMS logs, secure bill links, and estate settings.

## Secure bill links

Tenants view bills through `/bill/[token]` without logging in. Set `NEXT_PUBLIC_APP_URL` or `APP_URL` in production so SMS and email links use the public Yardle address. Demo mode includes stable secure tokens and supports link regeneration in memory.