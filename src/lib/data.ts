import { randomUUID } from "node:crypto";
import { calculateBill } from "./billing";
import { sendAndLogSms } from "./sms-logging";
import { renderSmsTemplate } from "./sms-templates";
import { nextPeriodDetails } from "./period-cycle";
import { getPaymentInstructions } from "./payment-instructions";
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
  setupError?: string;
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
  const setupError = estates.rows[0] ? undefined : "No estate record found. Run npm run db:seed or create the estate setup record before using Yardle.";
  const fallbackEstate: Estate = {
    id: "setup-required",
    name: "Yardle setup required",
    address: "",
    contactEmail: "",
    contactPhone: "",
    defaultKwhRatePence: 0,
    defaultStandingChargePence: 0,
    defaultLevyPence: 0,
    currency: "GBP",
    smsSenderName: "Yardle",
    createdAt: new Date().toISOString()
  };
  return {
    users: users.rows.map(mapUser),
    estate: estates.rows[0] ? mapEstate(estates.rows[0]) : fallbackEstate,
    units: units.rows.map(mapUnit),
    billingPeriods: periods.rows.map(mapBillingPeriod),
    meterReadings: readings.rows.map(mapMeterReading),
    bills: bills.rows.map(mapBill),
    payments: payments.rows.map(mapPayment),
    smsLogs: smsLogs.rows.map(mapSmsLog),
    setupError
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
  const result = await query("select * from bills where id = ?", [id]);
  return result.rows[0] ? mapBill(result.rows[0]) : undefined;
}

export async function getUnitById(id: string) {
  if (!hasDatabaseUrl()) {
    return getDemoUnitById(id);
  }

  await ensureSeeded();
  const result = await query("select * from units where id = ?", [id]);
  return result.rows[0] ? mapUnit(result.rows[0]) : undefined;
}

export async function getBillingPeriodById(id: string) {
  if (!hasDatabaseUrl()) {
    return getDemoBillingPeriodById(id);
  }

  await ensureSeeded();
  const result = await query("select * from billing_periods where id = ?", [id]);
  return result.rows[0] ? mapBillingPeriod(result.rows[0]) : undefined;
}

export async function createBillsForPeriod(periodId: string) {
  if (!hasDatabaseUrl()) {
    createDemoBillsForPeriod(periodId);
    return;
  }

  await ensureSeeded();
  await transaction(async (client) => {
    const periodResult = await client.query("select * from billing_periods where id = ?", [periodId]);
    if (!periodResult.rows[0]) throw new Error("Billing period not found.");
    const period = mapBillingPeriod(periodResult.rows[0]);
    if (period.status === "issued" || period.status === "locked") return;
    const requiredResult = await client.query("select id from units where status = 'active' and free_supply_meter = 0");
    const completedResult = await client.query("select unit_id from meter_readings where billing_period_id = ?", [periodId]);
    const completedIds = new Set(completedResult.rows.map((row) => row.unit_id));
    const missing = requiredResult.rows.filter((row) => !completedIds.has(row.id));
    if (missing.length) throw new Error(`${missing.length} required meter readings are still missing.`);
    const unitsResult = await client.query("select * from units where status in ('active', 'empty') order by unit_reference");
    const readingsResult = await client.query("select * from meter_readings where billing_period_id = ?", [periodId]);
    const readings = readingsResult.rows.map(mapMeterReading);
    for (const unitRow of unitsResult.rows) {
      const unit = mapUnit(unitRow);
      const reading = readings.find((item) => item.unitId === unit.id);
      if (!reading) continue;
      const bill = calculateBill({ unit, period, reading });
      const billId = randomUUID();
      await client.query(
        `insert into bills (id, billing_period_id, unit_id, previous_reading, current_reading, \`usage\`, kwh_rate_pence, standing_charge_pence, levy_pence, usage_cost_pence, subtotal_pence, outstanding_carried_forward_pence, total_due_pence, rounded_total_pence, amount_paid_pence, remaining_balance_pence, paid_status, admin_notes, tenant_notes, pdf_url, issued_at, sms_sent_at, created_at)
         values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,'unpaid',?,?,?,utc_timestamp(),utc_timestamp(),utc_timestamp())
         on duplicate key update previous_reading = values(previous_reading), current_reading = values(current_reading), \`usage\` = values(\`usage\`), kwh_rate_pence = values(kwh_rate_pence), standing_charge_pence = values(standing_charge_pence), levy_pence = values(levy_pence), usage_cost_pence = values(usage_cost_pence), subtotal_pence = values(subtotal_pence), outstanding_carried_forward_pence = values(outstanding_carried_forward_pence), total_due_pence = values(total_due_pence), rounded_total_pence = values(rounded_total_pence), remaining_balance_pence = values(remaining_balance_pence), tenant_notes = values(tenant_notes), pdf_url = values(pdf_url), issued_at = values(issued_at), sms_sent_at = utc_timestamp()`,
        [billId, period.id, unit.id, bill.previousReading, bill.currentReading, bill.usage, bill.kwhRatePence, bill.standingChargePence, bill.levyPence, bill.usageCostPence, bill.subtotalPence, bill.outstandingCarriedForwardPence, bill.totalDuePence, bill.roundedTotalPence, bill.remainingBalancePence, bill.adminNotes ?? null, bill.tenantNotes ?? null, unit.tenantAccessToken ? `/bill/${unit.tenantAccessToken}` : null]
      );
      if (unit.tenantAccessEnabled && unit.tenantAccessToken && unit.tenantMobile) {
        const billRow = await client.query<{ id: string }>("select id from bills where billing_period_id = ? and unit_id = ? limit 1", [period.id, unit.id]);
        await sendAndLogSms(
          {
            billId: billRow.rows[0]?.id ?? billId,
            unitId: unit.id,
            mobile: unit.tenantMobile,
            message: await renderSmsTemplate("bill_generated", {
              estateName: "Yardle",
              tenantName: unit.tenantName || "Tenant",
              unitNumber: unit.unitReference,
              billType: period.name,
              amount: new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(bill.roundedTotalPence / 100),
              dueDate: period.endDate,
              paymentLink: `${(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")}/bill/${unit.tenantAccessToken}`
            }, client)
          },
          client
        );
      }
    }
    await client.query("update billing_periods set status = 'locked', issued_at = utc_timestamp() where id = ?", [periodId]);
    const draftResult = await client.query("select id from billing_periods where estate_id = ? and status = 'draft' and id != ? limit 1", [period.estateId, periodId]);
    if (!draftResult.rows[0]) {
      const next = nextPeriodDetails(period);
      await client.query(`insert into billing_periods (id, estate_id, name, start_date, end_date, status, kwh_rate_pence, standing_charge_pence, levy_pence, created_by) values (?,?,?,?,?,'draft',?,?,?,?)`, [randomUUID(), next.estateId, next.name, next.startDate, next.endDate, next.kwhRatePence, next.standingChargePence, next.levyPence, next.createdBy || null]);
    }
  });
}
export interface PublicBillData {
  estate: Estate;
  unit: Unit;
  bills: Bill[];
  billingPeriods: BillingPeriod[];
  payments: Payment[];
  paymentInstructions: string;
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
      payments: data.payments.filter((payment) => payment.unitId === unit.id),
      paymentInstructions: await getPaymentInstructions()
    };
  }

  await ensureSeeded();
  const unitResult = await query(
    "select * from units where tenant_access_token = ? and tenant_access_enabled = 1 limit 1",
    [token]
  );
  if (!unitResult.rows[0]) return undefined;
  const unit = mapUnit(unitResult.rows[0]);
  const [estateResult, billsResult, periodsResult, paymentsResult, paymentInstructions] = await Promise.all([
    query("select * from estates where id = ? limit 1", [unit.estateId]),
    query("select * from bills where unit_id = ? order by issued_at is null, issued_at desc, created_at desc", [unit.id]),
    query("select bp.* from billing_periods bp join bills b on b.billing_period_id = bp.id where b.unit_id = ? order by bp.start_date desc", [unit.id]),
    query("select * from payments where unit_id = ? order by payment_date desc, created_at desc", [unit.id]),
    getPaymentInstructions()
  ]);
  if (!estateResult.rows[0]) return undefined;
  return {
    estate: mapEstate(estateResult.rows[0]),
    unit,
    bills: billsResult.rows.map(mapBill),
    billingPeriods: periodsResult.rows.map(mapBillingPeriod),
    payments: paymentsResult.rows.map(mapPayment),
    paymentInstructions
  };
}

