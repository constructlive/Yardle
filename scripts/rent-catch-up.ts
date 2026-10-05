import { loadLocalEnv } from "./env";
import { catchUpAll } from "../src/lib/rent-ledger/store";
import { closePool, hasDatabaseUrl } from "../src/lib/db";
loadLocalEnv();
async function main() {
  if (!hasDatabaseUrl()) throw new Error("The scheduler requires a persistent database.");
  try { console.log(JSON.stringify({ at: new Date().toISOString(), chargesCreated: await catchUpAll() })); } finally { await closePool(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
