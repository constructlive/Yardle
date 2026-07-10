# Yardle MariaDB Setup

Yardle production persistence uses MariaDB/MySQL via `mysql2`.

## 1. Create the database and user

In Plesk, create a MariaDB database named `yardle` and a database user such as `yardle_user`.

Equivalent SQL:

```sql
create database yardle character set utf8mb4 collate utf8mb4_unicode_ci;
create user 'yardle_user'@'localhost' identified by 'CHANGE_ME';
grant all privileges on yardle.* to 'yardle_user'@'localhost';
flush privileges;
```

## 2. Configure environment variables

Preferred:

```bash
DATABASE_URL=mysql://yardle_user:CHANGE_ME@127.0.0.1:3306/yardle
AUTH_SECRET=CHANGE_ME
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-long-random-password
```

You can also use `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` instead of `DATABASE_URL`.

## 3. Apply the schema

```bash
npm run db:setup
```

This imports `database/mariadb-schema.sql` using InnoDB, `utf8mb4`, application-generated UUID strings, `TINYINT(1)` booleans, and MariaDB-compatible indexes/foreign keys.

## 4. Optional production seed

The seed command creates only the required single-estate baseline and default settings. It is idempotent and does not create demo tenants, demo bills, readings, payments, or SMS logs:

```bash
npm run db:seed
```

Run it after `db:setup` when the database needs the initial Yardle estate/settings rows.

## 5. Create the first admin

```bash
npm run create-admin
```

The script prompts for name, email, password, and role, hashes the password with bcrypt, and inserts or updates the admin user safely.

## Notes

- Public tenant bill links remain passwordless and are stored as unique secure tokens on `units`.
- Money is stored as integer pence.
- Timestamps are stored as UTC `DATETIME` values.
- Leave `DATABASE_URL` unset in local development to use Yardle Demo Mode.