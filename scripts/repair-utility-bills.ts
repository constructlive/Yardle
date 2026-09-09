import { closePool, query, transaction } from "../src/lib/db";
import { loadLocalEnv } from "./env";

loadLocalEnv();

type PeriodRow = { id: string; name: string };
type BillRow = {
  bill_id: string;
  unit_id: string;
  unit_reference: string;
  tenant_name: string | null;
  subtotal_pence: number;
  current_carried_forward_pence: number;
  current_total_due_pence: number;
  current_rounded_total_pence: number;
  current_amount_paid_pence: number;
  current_remaining_balance_pence: number;
  current_paid_status: string;
  previous_remaining_balance_pence: number | null;
};

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

function paidStatus(totalPence: number, paidPence: number) {
  const remainingPence = totalPence - paidPence;
  if (remainingPence < 0) return "credited";
  if (remainingPence === 0) return "paid";
  if (paidPence > 0) return "part_paid";
  return "unpaid";
}

async function findTargetPeriod() {
  const periodId = argValue("--period-id");
  if (periodId) {
    const result = await query<PeriodRow>("select id, name from billing_periods where id = ? limit 1", [periodId]);
    return result.rows[0];
  }

  const periodName = argValue("--period-name") ?? argValue("--period");
  if (periodName) {
    const result = await query<PeriodRow>(
      "select id, name from billing_periods where name like ? order by start_date desc limit 1",
      [`%${periodName}%`]
    );
    return result.rows[0];
  }

  const result = await query<PeriodRow>(
    "select id, name from billing_periods where status in ('issued', 'locked') order by start_date desc, coalesce(issued_at, created_at) desc limit 1"
  );
  return result.rows[0];
}

async function main() {
  const apply = process.argv.includes("--apply");
  const period = await findTargetPeriod();

  if (!period) {
    console.log("No issued or locked billing period found to repair.");
    return;
  }

  const result = await query<BillRow>(
    `
      select
        b.id as bill_id,
        b.unit_id,
        u.unit_reference,
        u.tenant_name,
        b.subtotal_pence,
        b.outstanding_carried_forward_pence as current_carried_forward_pence,
        b.total_due_pence as current_total_due_pence,
        b.rounded_total_pence as current_rounded_total_pence,
        b.amount_paid_pence as current_amount_paid_pence,
        b.remaining_balance_pence as current_remaining_balance_pence,
        b.paid_status as current_paid_status,
        previous.remaining_balance_pence as previous_remaining_balance_pence
      from bills b
      join units u on u.id = b.unit_id
      join billing_periods current_period on current_period.id = b.billing_period_id
      left join bills previous on previous.id = (
        select pb.id
        from bills pb
        join billing_periods pp on pp.id = pb.billing_period_id
        where pb.unit_id = b.unit_id
          and pp.end_date < current_period.start_date
          and pp.status in ('issued', 'locked')
        order by pp.end_date desc, coalesce(pp.issued_at, pb.issued_at, pb.created_at) desc, pb.created_at desc
        limit 1
      )
      where b.billing_period_id = ?
      order by u.unit_reference
    `,
    [period.id]
  );

  const changes = result.rows
    .map((row) => {
      const carriedForwardPence = Number(row.previous_remaining_balance_pence ?? 0);
      const totalDuePence = Number(row.subtotal_pence ?? 0) + carriedForwardPence;
      const roundedTotalPence = Math.round(totalDuePence / 100) * 100;
      const amountPaidPence = Number(row.current_amount_paid_pence ?? 0);
      const remainingBalancePence = roundedTotalPence - amountPaidPence;
      const status = paidStatus(roundedTotalPence, amountPaidPence);
      return {
        ...row,
        current_carried_forward_pence: Number(row.current_carried_forward_pence ?? 0),
        current_total_due_pence: Number(row.current_total_due_pence ?? 0),
        current_rounded_total_pence: Number(row.current_rounded_total_pence ?? 0),
        current_remaining_balance_pence: Number(row.current_remaining_balance_pence ?? 0),
        carriedForwardPence,
        totalDuePence,
        roundedTotalPence,
        remainingBalancePence,
        status
      };
    })
    .filter(
      (row) =>
        row.current_carried_forward_pence !== row.carriedForwardPence ||
        row.current_total_due_pence !== row.totalDuePence ||
        row.current_rounded_total_pence !== row.roundedTotalPence ||
        row.current_remaining_balance_pence !== row.remainingBalancePence ||
        row.current_paid_status !== row.status
    );

  if (!changes.length) {
    console.log(`${period.name} bills already have the correct carried-forward balances.`);
    return;
  }

  console.log(`${changes.length} bill${changes.length === 1 ? "" : "s"} in ${period.name} need repairing.`);
  for (const row of changes) {
    console.log(
      `Unit ${row.unit_reference} - ${row.tenant_name || "No tenant"}: carried forward ${formatMoney(row.current_carried_forward_pence)} -> ${formatMoney(row.carriedForwardPence)}, total ${formatMoney(row.current_rounded_total_pence)} -> ${formatMoney(row.roundedTotalPence)}, remaining ${formatMoney(row.current_remaining_balance_pence)} -> ${formatMoney(row.remainingBalancePence)}`
    );
  }

  if (!apply) {
    console.log("Dry run only. Add -- --apply to update the bills and current unit balances.");
    console.log('Example: npm run utility:repair-current-bills -- --period-name "1st August" --apply');
    return;
  }

  await transaction(async (client) => {
    for (const row of changes) {
      await client.query(
        `update bills
         set outstanding_carried_forward_pence = ?,
             total_due_pence = ?,
             rounded_total_pence = ?,
             remaining_balance_pence = ?,
             paid_status = ?
         where id = ?`,
        [row.carriedForwardPence, row.totalDuePence, row.roundedTotalPence, row.remainingBalancePence, row.status, row.bill_id]
      );
      await client.query("update units set current_balance_pence = ? where id = ?", [row.remainingBalancePence, row.unit_id]);
    }
  });

  console.log(`Updated ${changes.length} bill${changes.length === 1 ? "" : "s"} and matching unit balances for ${period.name}.`);
}

main()
  .catch((error) => {
    console.error("Failed to repair utility bills:", error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await closePool();
  });
