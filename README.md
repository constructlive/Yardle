# Yardle

Yardle is a standalone tablet-first estate management and electricity billing application built for one industrial estate. It replaces spreadsheet billing with unit and tenant management, meter reading entry, bill review, simulated or Twilio-backed bill issue/SMS logging, tenant bill views, payments, reporting, and historical Anderson Yard bill imports.

## Stack

- Next.js, React, TypeScript
- Tailwind CSS
- MariaDB/MySQL persistence through `mysql2`
- Role-based admin authentication scaffolding for around 3 administrators
- Mock SMS provider and production Twilio SMS sending
- PDF-ready bill HTML generator

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

When `DATABASE_URL` is not set, Yardle runs in local Demo Mode using the bundled `src/lib/demo-data.ts` data through an in-memory store. The admin header shows a small Demo Mode badge, and local preview pages load without MariaDB. Demo Mode changes last for the current dev server session only.

When `DATABASE_URL` is set, Yardle uses MariaDB for persistent app data. `npm run db:seed` creates only the required single-estate baseline and default settings; it does not create demo tenants or bills.

## Database

Create a MariaDB database and run:

```bash
npm run db:setup
```

Optional production seed for the single-estate baseline:

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

`SMS_PROVIDER=mock` logs simulated SMS messages for local development. Set `SMS_PROVIDER=twilio` in production to send through Twilio. Configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`, and `NEXT_PUBLIC_APP_URL=https://yardle.andersonyard.co.uk`. Yardle normalises UK mobile numbers before sending and records provider status, Twilio SID, sent time, and safe failure messages in the SMS log.

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

Next production steps include adding server-side PDF rendering/storage and any extra email provider adapter required later.

## Persistent database

Set `DATABASE_URL` in `.env.local`, run `npm run db:setup`, then start the app. Pages read and write MariaDB data instead of using demo arrays. Persistent writes include units/tenants, meter readings, billing periods, bill issuing, payments, landlord payment updates, SMS logs, secure bill links, and estate settings.

## Secure bill links

Tenants view bills through `/bill/[token]` without logging in. Set `NEXT_PUBLIC_APP_URL` or `APP_URL` in production so SMS and email links use the public Yardle address. Demo mode includes stable secure tokens and supports link regeneration in memory.
## Historical Anderson Yard Import

The Historic Import page at `/admin/import` accepts `.xlsx`, `.xls`, and `.csv` files, including multiple monthly workbooks at once. Parsing happens server-side with the `xlsx` package. Yardle looks for the `Master` sheet where available, ignores repeated headings, totals, summary rows, and presentation-only rows, then previews genuine unit bill rows before anything is committed.

Import matching is by unit reference only. Unit references are trimmed, compared case-insensitively, repeated spaces are collapsed, and safe slash spacing is normalised, so `11a` matches `11A`, `flat 1` matches `FLAT 1`, and `2 / 3` matches `2/3`. Tenant names from the workbook are historical billed-to snapshots only. A workbook name mismatch is shown as a warning and never overwrites the current tenant or creates a tenant.

Billing periods are detected from workbook content, for example `1st June - 30th June` or `01/06/2026 - 30/06/2026`. If the workbook text has no year, Yardle uses a year found in the filename. If neither source contains a year, the admin must enter the fallback year in the preview form before importing.

Confirmed imports write to `historical_import_batches` and `historical_bills`. They do not create current bills, send SMS, email tenants, change balances, alter meter readings, change current occupancy, or rename tenants. Duplicate protection uses one historical bill per estate, unit, period start, and period end; duplicates are shown in preview and skipped on commit.

## SMS Providers

`SMS_PROVIDER=mock` is the safe default. It never contacts Twilio, logs simulated messages, and allows bill issue and reminder flows to be tested.

Set `SMS_PROVIDER=twilio` in production to send real SMS through Twilio. Configure:

```bash
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=CHANGE_ME
TWILIO_AUTH_TOKEN=CHANGE_ME
TWILIO_FROM=+44...
NEXT_PUBLIC_APP_URL=https://yardle.andersonyard.co.uk
```

Yardle normalises UK mobile numbers before sending: `07960 123456` and `447960123456` become `+447960123456`; numbers already beginning with `+` are preserved after spaces, brackets, and hyphens are removed. Blank or invalid numbers are logged as failed with a safe error. Twilio credentials are never exposed to browser code.

Use `/admin/sms` to send an administrator-only test SMS. The page shows whether mock or Twilio mode is active, warns before real provider sends, and writes the result to `sms_logs` with provider, status, provider SID where available, sent timestamp, and safe failure reason.

## Deployment Commands

After pulling the latest code on the server:

```bash
npm install
npm run db:setup
npm run db:seed
npm run typecheck
npm run build
pm2 restart yardle
```

`npm run db:setup` is safe to run against an existing MariaDB database; it creates the historical import tables and SMS failure-reason column if needed. Use your actual process manager command if Yardle is not managed by PM2.

## Manual Test Procedures

Historical import test:

1. Sign in as an administrator.
2. Open `/admin/import`.
3. Upload one or more Anderson Yard workbooks or CSV files.
4. Confirm the detected billing periods, matched units, historical imported names, current tenants, warnings, and duplicates.
5. Confirm import as historical records without notifications.
6. Refresh and re-upload the same file to verify rows are marked duplicate.
7. Check that current unit tenants, unit statuses, balances, current bills, meter readings, and SMS logs are unchanged.

Mock SMS test:

1. Set `SMS_PROVIDER=mock`.
2. Open `/admin/sms`.
3. Send a test SMS to a UK-style number.
4. Verify the result is logged as `simulated` and no Twilio request is made.

Twilio test:

1. Set `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`, and `NEXT_PUBLIC_APP_URL=https://yardle.andersonyard.co.uk`.
2. Restart the app.
3. Open `/admin/sms` and send a test SMS.
4. Verify the number is normalised, the provider is `twilio`, the Twilio SID is recorded, and failures show only safe messages.