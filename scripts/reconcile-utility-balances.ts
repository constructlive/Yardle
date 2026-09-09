import { closePool, query } from "../src/lib/db";
import { loadLocalEnv } from "./env";

loadLocalEnv();

type BalanceRow = {
  unit_id: string;
  unit_reference: string;
  tenant_name: string | null;
  current_balance_pence: number;
  bill_id: string;
  period_name: string;
  period_end: string;
  remaining_balance_pence: number;
};

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

async function main() {
  const apply = process.argv.includes("--apply");

  const result = await query<BalanceRow>(`
    select unit_id, unit_reference, tenant_name, current_balance_pence, bill_id, period_name, period_end, remaining_balance_pence from (
      select
        u.id as unit_id,
        u.unit_reference,
        u.tenant_name,
        u.current_balance_pence,
        b.id as bill_id,
        bp.name as period_name,
        bp.end_date as period_end,
        b.remaining_balance_pence,
        row_number() over (
          partition by u.id
          order by bp.end_date desc, coalesce(bp.issued_at, b.issued_at, b.created_at) desc, b.created_at desc
        ) as row_number_for_unit
      from units u
      join bills b on b.unit_id = u.id
      join billing_periods bp on bp.id = b.billing_period_id
      where bp.status in ('issued', 'locked')
    ) latest
    where row_number_for_unit = 1
    order by unit_reference
  `);

  const changes = result.rows
    .map((row) => ({
      ...row,
      current_balance_pence: Number(row.current_balance_pence ?? 0),
      remaining_balance_pence: Number(row.remaining_balance_pence ?? 0)
    }))
    .filter((row) => row.current_balance_pence !== row.remaining_balance_pence);

  if (!changes.length) {
    console.log("Utility balances already match the latest issued bills. No changes needed.");
    return;
  }

  console.log(`${changes.length} unit balance${changes.length === 1 ? "" : "s"} need reconciling from latest issued utility bills.`);
  for (const row of changes) {
    console.log(`Unit ${row.unit_reference} - ${row.tenant_name || "No tenant"} - ${row.period_name}: ${formatMoney(row.current_balance_pence)} -> ${formatMoney(row.remaining_balance_pence)}`);
  }

  if (!apply) {
    console.log("Dry run only. Run npm run utility:reconcile-balances -- --apply to update units.current_balance_pence.");
    return;
  }

  for (const row of changes) {
    await query("update units set current_balance_pence = ? where id = ?", [row.remaining_balance_pence, row.unit_id]);
  }
  console.log(`Updated ${changes.length} unit balance${changes.length === 1 ? "" : "s"}.`);
}

main()
  .catch((error) => {
    console.error("Failed to reconcile utility balances:", error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await closePool();
  });