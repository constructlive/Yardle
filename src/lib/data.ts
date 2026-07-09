import { calculateBill } from "./billing";
import { getTenantBillUrl } from "./secure-link";
import { buildBillSms } from "./sms";
import { nextPeriodDetails } from "./period-cycle";
import { ensureSeeded, hasDatabaseUrl, query, transaction } from "./db";
import { createDemoBillsForPeriod, getDemoAppData, getDemoBillingPeriodById, getDemoBillById, getDemoUnitByAccessToken, getDemoUnitById } from "./demo-store";
import { mapBill, mapBillingPeriod, mapEstate, mapMeterReading, mapPayment, mapSmsLog, mapUnit, mapUser } from "./mappers";
import type { Bill, BillingPeriod, Estate, MeterReading, Payment, SmsLog, Unit, User } from "./types";

export interface AppData {
  users: User[];
  estate: Estate;
  units: Unit[];
  billingPeriods: BillingPeriod[];
  meterReadings: MeterReading[];
  bills: Bill[];
  payments: Payment[];
  smsLogs: SmsLog[];
}

export async function getAppData(): Promise<AppData> {
  if (!hasDatabaseUrl()) {
    return getDemoAppData();
  }

  await ensureSeeded();
  const [users, estates, units, periods, readings, bills, payments, smsLogs] = await Promise.all([
    query("select * from users order by created_at"),
    query("select * from estates order by created_at limit 1"),
    query("select * from units order by unit_reference"),
    query("select * from billing_periods order by start_date desc"),
    query("select * from meter_readings order by entered_at desc"),
    query("select * from bills order by created_at desc"),
    query("select * from payments order by payment_date desc, created_at desc"),
    query("select * from sms_logs order by created_at desc")
  ]);
  if (!estates.rows[0]) {
    throw new Error("No estate found after seed. Check database/schema.sql and DATABASE_URL.");
  }
  return {
    users: users.rows.map(mapUser),
    estate: mapEstate(estates.rows[0]),
    units: units.rows.map(mapUnit),
    billingPeriods: periods.rows.map(mapBillingPeriod),
    meterReadings: readings.rows.map(mapMeterReading),
    bills: bills.rows.map(mapBill),
    payments: payments.rows.map(mapPayment),
    smsLogs: smsLogs.rows.map(mapSmsLog)
  };
}

export async function getEstate() {
  const data = await getAppData();
  return data.estate;
}

export async function getTenantUnit() {
  const data = await getAppData();
  return data.units.find((unit) => unit.tenantName === "Priya Motors") ?? data.units[0];
}

export async function getBillById(id: string) {
  if (!hasDatabaseUrl()) {
    return getDemoBillById(id);
  }

  await ensureSeeded();
  const result = await query("select * from bills where id = $1", [id]);
  return result.rows[0] ? mapBill(result.rows[0]) : undefined;
}

export async function getUnitById(id: string) {
  if (!hasDatabaseUrl()) {
    return getDemoUnitById(id);
  }

  await ensureSeeded();
  const result = await query("select * from units where id = $1", [id]);
  return result.rows[0] ? mapUnit(result.rows[0]) : undefined;
}

export async function getBillingPeriodById(id: string) {
  if (!hasDatabaseUrl()) {
    return getDemoBillingPeriodById(id);
  }

  await ensureSeeded();
  const result = await query("select * from billing_periods where id = $1", [id]);
  return result.rows[0] ? mapBillingPeriod(result.rows[0]) : undefined;
}

export async function createBillsForPeriod(periodId: string) {
  if (!hasDatabaseUrl()) {
    createDemoBillsForPeriod(periodId);
    return;
  }

  await ensureSeeded();
  await transaction(async (client) => {
    const periodResult = await client.query("select * from billing_periods where id = $1", [periodId]);
    if (!periodResult.rows[0]) throw new Error("Billing period not found.");
    const period = mapBillingPeriod(periodResult.rows[0]);
    if (period.status === "issued" || period.status === "locked") return;
    const requiredResult = await client.query("select id from units where status = 'active' and free_supply_meter = false");
    const completedResult = await client.query("select unit_id from meter_readings where billing_period_id = $1", [periodId]);
    const completedIds = new Set(completedResult.rows.map((row) => row.unit_id));
    const missing = requiredResult.rows.filter((row) => !completedIds.has(row.id));
    if (missing.length) throw new Error(`${missing.length} required meter readings are still missing.`);
    const unitsResult = await client.query("select * from units where status in ('active', 'empty') order by unit_reference");
    const readingsResult = await client.query("select * from meter_readings where billing_period_id = $1", [periodId]);
    const readings = readingsResult.rows.map(mapMeterReading);
    for (const unitRow of unitsResult.rows) {
      const unit = mapUnit(unitRow);
      const reading = readings.find((item) => item.unitId === unit.id);
      if (!reading) continue;
      const bill = calculateBill({ unit, period, reading });
      const savedBill = await client.query<{ id: string }>(
        `insert into bills (billing_period_id, unit_id, previous_reading, current_reading, usage, kwh_rate_pence, standing_charge_pence, levy_pence, usage_cost_pence, subtotal_pence, outstanding_carried_forward_pence, total_due_pence, rounded_total_pence, amount_paid_pence, remaining_balance_pence, paid_status, admin_notes, tenant_notes, pdf_url, issued_at, sms_sent_at, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,0,$14,'unpaid',$15,$16,$17,now(),now(),now())
         on conflict (billing_period_id, unit_id) do update set previous_reading = excluded.previous_reading, current_reading = excluded.current_reading, usage = excluded.usage, kwh_rate_pence = excluded.kwh_rate_pence, standing_charge_pence = excluded.standing_charge_pence, levy_pence = excluded.levy_pence, usage_cost_pence = excluded.usage_cost_pence, subtotal_pence = excluded.subtotal_pence, outstanding_carried_forward_pence = excluded.outstanding_carried_forward_pence, total_due_pence = excluded.total_due_pence, rounded_total_pence = excluded.rounded_total_pence, remaining_balance_pence = excluded.remaining_balance_pence, tenant_notes = excluded.tenant_notes, pdf_url = excluded.pdf_url, issued_at = excluded.issued_at, sms_sent_at = now() returning id`,
        [period.id, unit.id, bill.previousReading, bill.currentReading, bill.usage, bill.kwhRatePence, bill.standingChargePence, bill.levyPence, bill.usageCostPence, bill.subtotalPence, bill.outstandingCarriedForwardPence, bill.totalDuePence, bill.roundedTotalPence, bill.remainingBalancePence, bill.adminNotes ?? null, bill.tenantNotes ?? null, unit.tenantAccessToken ? `/bill/${unit.tenantAccessToken}` : null]
      );
      if (unit.tenantAccessEnabled && unit.tenantAccessToken && unit.tenantMobile && savedBill.rows[0]) {
        const message = buildBillSms(period, bill, getTenantBillUrl(unit.tenantAccessToken));
        await client.query(`insert into sms_logs (bill_id, unit_id, mobile, message, status, provider, provider_reference, sent_at) values ($1,$2,$3,$4,'simulated','mock',$5,now())`, [savedBill.rows[0].id, unit.id, unit.tenantMobile, message, `mock-${Date.now()}`]);
      }
    }
    await client.query("update billing_periods set status = 'locked', issued_at = now() where id = $1", [periodId]);
    const draftResult = await client.query("select id from billing_periods where estate_id = $1 and status = 'draft' and id != $2 limit 1", [period.estateId, periodId]);
    if (!draftResult.rows[0]) {
      const next = nextPeriodDetails(period);
      await client.query(`insert into billing_periods (estate_id, name, start_date, end_date, status, kwh_rate_pence, standing_charge_pence, levy_pence, created_by) values ($1,$2,$3,$4,'draft',$5,$6,$7,$8)`, [next.estateId, next.name, next.startDate, next.endDate, next.kwhRatePence, next.standingChargePence, next.levyPence, next.createdBy || null]);
    }
  });
}
export interface PublicBillData {
  estate: Estate;
  unit: Unit;
  bills: Bill[];
  billingPeriods: BillingPeriod[];
  payments: Payment[];
}

export async function getPublicBillData(token: string): Promise<PublicBillData | undefined> {
  if (!token || token.length < 32) return undefined;

  if (!hasDatabaseUrl()) {
    const unit = getDemoUnitByAccessToken(token);
    if (!unit) return undefined;
    const data = getDemoAppData();
    const bills = data.bills.filter((bill) => bill.unitId === unit.id);
    const periodIds = new Set(bills.map((bill) => bill.billingPeriodId));
    return {
      estate: data.estate,
      unit,
      bills,
      billingPeriods: data.billingPeriods.filter((period) => periodIds.has(period.id)),
      payments: data.payments.filter((payment) => payment.unitId === unit.id)
    };
  }

  await ensureSeeded();
  const unitResult = await query(
    "select * from units where tenant_access_token = $1 and tenant_access_enabled = true limit 1",
    [token]
  );
  if (!unitResult.rows[0]) return undefined;
  const unit = mapUnit(unitResult.rows[0]);
  const [estateResult, billsResult, periodsResult, paymentsResult] = await Promise.all([
    query("select * from estates where id = $1 limit 1", [unit.estateId]),
    query("select * from bills where unit_id = $1 order by issued_at desc nulls last, created_at desc", [unit.id]),
    query("select bp.* from billing_periods bp join bills b on b.billing_period_id = bp.id where b.unit_id = $1 order by bp.start_date desc", [unit.id]),
    query("select * from payments where unit_id = $1 order by payment_date desc, created_at desc", [unit.id])
  ]);
  if (!estateResult.rows[0]) return undefined;
  return {
    estate: mapEstate(estateResult.rows[0]),
    unit,
    bills: billsResult.rows.map(mapBill),
    billingPeriods: periodsResult.rows.map(mapBillingPeriod),
    payments: paymentsResult.rows.map(mapPayment)
  };
}

