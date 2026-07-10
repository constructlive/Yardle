import { loadLocalEnv } from "./env";
import { ensureSeeded } from "../src/lib/db";
import { seedDatabaseIfEmpty } from "../src/lib/seed";

loadLocalEnv();
await ensureSeeded();
await seedDatabaseIfEmpty();
console.log("Demo seed data inserted if the database was empty.");