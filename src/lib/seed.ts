import type { PoolClient } from "pg";
import { bills, billingPeriods, estate, meterReadings, payments, smsLogs, units, users } from "./demo-data";
import { transaction } from "./db";

async function insertOne(client: PoolClient, sql: string, params: unknown[]) {
  const result = await client.query<{ id: string }>(sql, params);
  return result.rows[0].id;
}

export async function seedDatabaseIfEmpty() {
  await transaction(async (client) => {
    const count = await client.query<{ count: string }>("select count(*) from estates");
    if (Number(count.rows[0].count) > 0) {
      return;
    }

    const estateId = await insertOne(
      client,
      `insert into estates (name, address, contact_email, contact_phone, logo_url, default_kwh_rate_pence, default_standing_charge_pence, default_levy_pence, currency, sms_sender_name, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
      [estate.name, estate.address, estate.contactEmail, estate.contactPhone, estate.logoUrl ?? null, estate.defaultKwhRatePence, estate.defaultStandingChargePence, estate.defaultLevyPence, estate.currency, estate.smsSenderName, estate.createdAt]
    );

    const userMap = new Map<string, string>();
    for (const user of users) {
      const id = await insertOne(
        client,
        `insert into users (name, email, mobile, role, created_at) values ($1,$2,$3,$4,$5) returning id`,
        [user.name, user.email, user.mobile, user.role, user.createdAt]
      );
      userMap.set(user.id, id);
    }

    const unitMap = new Map<string, string>();
    for (const unit of units) {
      const id = await insertOne(
        client,
        `insert into units (estate_id, unit_reference, tenant_name, tenant_contact_name, tenant_email, tenant_mobile, status, notes, free_supply_meter, custom_kwh_rate_pence, custom_standing_charge_pence, opening_balance_pence, current_balance_pence, tenant_access_token, tenant_access_token_created_at, tenant_access_enabled, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning id`,
        [estateId, unit.unitReference, unit.tenantName, unit.tenantContactName, unit.tenantEmail, unit.tenantMobile, unit.status, unit.notes ?? null, unit.freeSupplyMeter, unit.customKwhRatePence ?? null, unit.customStandingChargePence ?? null, unit.openingBalancePence, unit.currentBalancePence, unit.tenantAccessToken, unit.tenantAccessTokenCreatedAt ?? unit.createdAt, unit.tenantAccessEnabled, unit.createdAt]
      );
      unitMap.set(unit.id, id);
    }

    const periodMap = new Map<string, string>();
    for (const period of billingPeriods) {
      const id = await insertOne(
        client,
        `insert into billing_periods (estate_id, name, start_date, end_date, status, kwh_rate_pence, standing_charge_pence, levy_pence, created_by, issued_at, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
        [estateId, period.name, period.startDate, period.endDate, period.status, period.kwhRatePence, period.standingChargePence, period.levyPence, userMap.get(period.createdBy) ?? null, period.issuedAt ?? null, period.createdAt]
      );
      periodMap.set(period.id, id);
    }

    const readingMap = new Map<string, string>();
    for (const reading of meterReadings) {
      const periodId = periodMap.get(reading.billingPeriodId);
      const unitId = unitMap.get(reading.unitId);
      if (!periodId || !unitId) continue;
      const id = await insertOne(
        client,
        `insert into meter_readings (billing_period_id, unit_id, previous_reading, current_reading, usage, is_estimated, reading_notes, reading_status, entered_by, entered_at, photo_url)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
        [periodId, unitId, reading.previousReading, reading.currentReading, reading.usage, reading.isEstimated, reading.readingNotes ?? null, reading.readingStatus, userMap.get(reading.enteredBy) ?? null, reading.enteredAt, reading.photoUrl ?? null]
      );
      readingMap.set(reading.id, id);
    }

    const billMap = new Map<string, string>();
    for (const bill of bills) {
      const periodId = periodMap.get(bill.billingPeriodId);
      const unitId = unitMap.get(bill.unitId);
      if (!periodId || !unitId) continue;
      const id = await insertOne(
        client,
        `insert into bills (billing_period_id, unit_id, previous_reading, current_reading, usage, kwh_rate_pence, standing_charge_pence, levy_pence, usage_cost_pence, subtotal_pence, outstanding_carried_forward_pence, total_due_pence, rounded_total_pence, amount_paid_pence, remaining_balance_pence, paid_status, payment_date, admin_notes, tenant_notes, pdf_url, issued_at, sms_sent_at, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) returning id`,
        [periodId, unitId, bill.previousReading, bill.currentReading, bill.usage, bill.kwhRatePence, bill.standingChargePence, bill.levyPence, bill.usageCostPence, bill.subtotalPence, bill.outstandingCarriedForwardPence, bill.totalDuePence, bill.roundedTotalPence, bill.amountPaidPence, bill.remainingBalancePence, bill.paidStatus, bill.paymentDate ?? null, bill.adminNotes ?? null, bill.tenantNotes ?? null, bill.pdfUrl ?? null, bill.issuedAt ?? null, bill.smsSentAt ?? null, bill.createdAt]
      );
      billMap.set(bill.id, id);
    }

    for (const payment of payments) {
      const billId = billMap.get(payment.billId);
      const unitId = unitMap.get(payment.unitId);
      if (!billId || !unitId) continue;
      await client.query(
        `insert into payments (bill_id, unit_id, amount_pence, payment_method, payment_date, notes, recorded_by, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [billId, unitId, payment.amountPence, payment.paymentMethod, payment.paymentDate, payment.notes ?? null, userMap.get(payment.recordedBy) ?? null, payment.createdAt]
      );
    }

    for (const log of smsLogs) {
      const billId = billMap.get(log.billId);
      const unitId = unitMap.get(log.unitId);
      if (!unitId) continue;
      await client.query(
        `insert into sms_logs (bill_id, unit_id, mobile, message, status, provider, provider_reference, sent_at, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [billId ?? null, unitId, log.mobile, log.message, log.status, log.provider, log.providerReference, log.sentAt ?? null, log.createdAt]
      );
    }
  });
}

