import { loadLocalEnv } from "./env";
import { catchUpAll } from "../src/lib/rent-ledger/store";
import { closePool, hasDatabaseUrl } from "../src/lib/db";
loadLocalEnv();
async function main() {
  if (!hasDatabaseUrl()) throw new Error("Rent scheduler requires a persistent database.");
  process.on("SIGTERM", async () => { await closePool(); process.exit(0); });
  process.on("SIGINT", async () => { await closePool(); process.exit(0); });
  for (;;) {
    try { console.log(JSON.stringify({ at: new Date().toISOString(), chargesCreated: await catchUpAll() })); }
    catch (error) { console.error("Rent catch-up failed; next run will retry safely.", error); }
    await new Promise(resolve => setTimeout(resolve, 300000));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
