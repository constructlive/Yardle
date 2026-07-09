"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { calculateUsage } from "./billing";
import { createBillsForPeriod, getAppData } from "./data";
import { ensureSeeded, hasDatabaseUrl, query, transaction } from "./db";
import { serializeTenantMeta } from "./tenant-meta";
import { createTenantAccessToken, getTenantBillUrl } from "./secure-link";
import { buildBillSms } from "./sms";
import { addDemoSmsLog, archiveDemoUnit, regenerateDemoTenantAccessToken, saveDemoBillingPeriod, saveDemoEstate, saveDemoMeterReading, saveDemoPaymentUpdate, saveDemoUnit } from "./demo-store";

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function bool(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function pence(value: FormDataEntryValue | null) {
  const raw = text(value);
  return raw ? Math.round(Number(raw) * 100) : null;
}

function numberValue(value: FormDataEntryValue | null) {
  const raw = text(value);
  return raw ? Number(raw) : 0;
}

export async function saveEstateSettings(formData: FormData) {
  if (!hasDatabaseUrl()) {
    saveDemoEstate({ name: text(formData.get("name")), contactEmail: text(formData.get("contactEmail")), contactPhone: text(formData.get("contactPhone")), smsSenderName: text(formData.get("smsSenderName")), defaultKwhRatePence: pence(formData.get("defaultKwhRate")) ?? 0, defaultStandingChargePence: pence(formData.get("defaultStandingCharge")) ?? 0, defaultLevyPence: pence(formData.get("defaultLevy")) ?? 0, address: text(formData.get("address")) });
    revalidatePath("/admin/settings");
    return;
  }
  await ensureSeeded();
  await query(
    `update estates set name = $1, contact_email = $2, contact_phone = $3, sms_sender_name = $4, default_kwh_rate_pence = $5, default_standing_charge_pence = $6, default_levy_pence = $7, address = $8 where id = $9`,
    [text(formData.get("name")), text(formData.get("contactEmail")), text(formData.get("contactPhone")), text(formData.get("smsSenderName")), pence(formData.get("defaultKwhRate")) ?? 0, pence(formData.get("defaultStandingCharge")) ?? 0, pence(formData.get("defaultLevy")) ?? 0, text(formData.get("address")), text(formData.get("estateId"))]
  );
  revalidatePath("/admin/settings");
}

export async function saveUnit(formData: FormData) {
  await ensureSeeded();
  const unitId = text(formData.get("unitId"));
  const estateId = text(formData.get("estateId"));
  const tenantAccessEnabled = bool(formData.get("tenantAccessEnabled"));
  const tenantNotes = serializeTenantMeta({
    notes: text(formData.get("notes")),
    billingAddress: text(formData.get("billingAddress")),
    portalLoginEmail: text(formData.get("tenantEmail")),
    portalEnabled: tenantAccessEnabled
  });
  const params = [
    estateId,
    text(formData.get("unitReference")),
    text(formData.get("tenantName")),
    text(formData.get("tenantContactName")),
    text(formData.get("tenantEmail")),
    text(formData.get("tenantMobile")),
    text(formData.get("status")),
    tenantNotes,
    bool(formData.get("freeSupplyMeter")),
    pence(formData.get("customKwhRate")),
    pence(formData.get("customStandingCharge")),
    pence(formData.get("openingBalance")) ?? 0,
    pence(formData.get("currentBalance")) ?? 0,
    tenantAccessEnabled
  ];
  if (!hasDatabaseUrl()) {
    saveDemoUnit(unitId, { estateId, unitReference: text(formData.get("unitReference")), tenantName: text(formData.get("tenantName")), tenantContactName: text(formData.get("tenantContactName")), tenantEmail: text(formData.get("tenantEmail")), tenantMobile: text(formData.get("tenantMobile")), status: text(formData.get("status")) as any, notes: tenantNotes, freeSupplyMeter: bool(formData.get("freeSupplyMeter")), customKwhRatePence: pence(formData.get("customKwhRate")) ?? undefined, customStandingChargePence: pence(formData.get("customStandingCharge")) ?? undefined, openingBalancePence: pence(formData.get("openingBalance")) ?? 0, currentBalancePence: pence(formData.get("currentBalance")) ?? 0, tenantAccessEnabled });
    revalidatePath("/admin/units");
    return;
  }
  if (unitId) {
    await query(
      `update units set estate_id=$1, unit_reference=$2, tenant_name=$3, tenant_contact_name=$4, tenant_email=$5, tenant_mobile=$6, status=$7, notes=$8, free_supply_meter=$9, custom_kwh_rate_pence=$10, custom_standing_charge_pence=$11, opening_balance_pence=$12, current_balance_pence=$13, tenant_access_enabled=$14 where id=$15`,
      [...params, unitId]
    );
  } else {
    await query(
      `insert into units (estate_id, unit_reference, tenant_name, tenant_contact_name, tenant_email, tenant_mobile, status, notes, free_supply_meter, custom_kwh_rate_pence, custom_standing_charge_pence, opening_balance_pence, current_balance_pence, tenant_access_enabled, tenant_access_token, tenant_access_token_created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now())`,
      [...params, createTenantAccessToken()]
    );
  }
  revalidatePath("/admin/units");
}

export async function archiveUnit(formData: FormData) {
  if (!hasDatabaseUrl()) {
    archiveDemoUnit(text(formData.get("unitId")));
    revalidatePath("/admin/units");
    return;
  }
  await ensureSeeded();
  await query("update units set status = 'inactive' where id = $1", [text(formData.get("unitId"))]);
  revalidatePath("/admin/units");
}

export async function saveBillingPeriod(formData: FormData) {
  const periodId = text(formData.get("periodId"));
  const estateId = text(formData.get("estateId"));
  const params = [text(formData.get("name")), text(formData.get("startDate")), text(formData.get("endDate")), pence(formData.get("kwhRate")) ?? 0, pence(formData.get("standingCharge")) ?? 0, pence(formData.get("levy")) ?? 0];
  if (!hasDatabaseUrl()) {
    saveDemoBillingPeriod(periodId, { estateId, name: params[0] as string, startDate: params[1] as string, endDate: params[2] as string, kwhRatePence: params[3] as number, standingChargePence: params[4] as number, levyPence: params[5] as number });
    revalidatePath("/admin/periods");
    return;
  }
  await ensureSeeded();
  if (periodId) {
    await query("update billing_periods set name=$1, start_date=$2, end_date=$3, kwh_rate_pence=$4, standing_charge_pence=$5, levy_pence=$6 where id=$7 and status != 'locked'", [...params, periodId]);
  } else {
    await query("insert into billing_periods (estate_id, name, start_date, end_date, status, kwh_rate_pence, standing_charge_pence, levy_pence) values ($1,$2,$3,$4,'draft',$5,$6,$7)", [estateId, ...params]);
  }
  revalidatePath("/admin/periods");
}

export async function saveMeterReading(formData: FormData) {
  const previous = numberValue(formData.get("previousReading"));
  const current = numberValue(formData.get("currentReading"));
  if (!hasDatabaseUrl()) {
    saveDemoMeterReading({ periodId: text(formData.get("periodId")), unitId: text(formData.get("unitId")), previous, current, isEstimated: bool(formData.get("isEstimated")), readingNotes: text(formData.get("readingNotes")) || undefined, photoUrl: text(formData.get("photoUrl")) || undefined });
    revalidatePath("/admin/readings");
    revalidatePath("/admin/bills/review");
    return;
  }
  await ensureSeeded();
  const usage = calculateUsage(previous, current);
  await query(
    `insert into meter_readings (billing_period_id, unit_id, previous_reading, current_reading, usage, is_estimated, reading_notes, reading_status, entered_by, entered_at, photo_url)
     values ($1,$2,$3,$4,$5,$6,$7,'confirmed',(select id from users where role in ('super_admin','admin') order by created_at limit 1),now(),$8)
     on conflict (billing_period_id, unit_id) do update set previous_reading=$3, current_reading=$4, usage=$5, is_estimated=$6, reading_notes=$7, reading_status='confirmed', entered_by=(select id from users where role in ('super_admin','admin') order by created_at limit 1), entered_at=now(), photo_url=$8`,
    [text(formData.get("periodId")), text(formData.get("unitId")), previous, current, usage, bool(formData.get("isEstimated")), text(formData.get("readingNotes")) || null, text(formData.get("photoUrl")) || null]
  );
  revalidatePath("/admin/readings");
  revalidatePath("/admin/bills/review");
}

export async function issueBills(formData: FormData) {
  await createBillsForPeriod(text(formData.get("periodId")));
  revalidatePath("/admin/bills");
  revalidatePath("/admin/bills/review");
  revalidatePath("/admin/periods");
  revalidatePath("/admin/readings");
  revalidatePath("/admin");
  redirect("/admin/bills");
}

export async function savePaymentUpdate(input: { billId: string; amountPaidPence: number; paymentMethod: string; paymentDate: string; notes: string }) {
  if (!hasDatabaseUrl()) {
    saveDemoPaymentUpdate(input);
    revalidatePath("/admin/payments");
    revalidatePath("/admin/landlord");
    revalidatePath("/admin/bills");
    return;
  }
  await ensureSeeded();
  const method = input.paymentMethod.toLowerCase().replaceAll(" ", "_") === "cheque" ? "other" : input.paymentMethod.toLowerCase().replaceAll(" ", "_");
  await transaction(async (client) => {
    const billResult = await client.query("select * from bills where id = $1", [input.billId]);
    const bill = billResult.rows[0];
    if (!bill) return;
    const remaining = Math.max(0, bill.rounded_total_pence - input.amountPaidPence);
    const status = input.amountPaidPence >= bill.rounded_total_pence ? "paid" : input.amountPaidPence > 0 ? "part_paid" : "unpaid";
    await client.query("update bills set amount_paid_pence=$1, remaining_balance_pence=$2, paid_status=$3, payment_date=$4, admin_notes=$5 where id=$6", [input.amountPaidPence, remaining, status, input.paymentDate || null, input.notes || null, input.billId]);
    await client.query("update units set current_balance_pence=$1 where id=$2", [remaining, bill.unit_id]);
    await client.query("delete from payments where bill_id = $1", [input.billId]);
    if (input.amountPaidPence > 0 && input.paymentDate && method) {
      await client.query(
        `insert into payments (bill_id, unit_id, amount_pence, payment_method, payment_date, notes)
         values ($1,$2,$3,$4,$5,$6)`,
        [input.billId, bill.unit_id, input.amountPaidPence, method, input.paymentDate, input.notes || null]
      );
    }
  });
  revalidatePath("/admin/payments");
  revalidatePath("/admin/landlord");
  revalidatePath("/admin/bills");
}

export async function saveSmsLog(formData: FormData) {
  if (!hasDatabaseUrl()) {
    addDemoSmsLog({ billId: text(formData.get("billId")) || undefined, unitId: text(formData.get("unitId")) || undefined, mobile: text(formData.get("mobile")), message: text(formData.get("message")), status: (text(formData.get("status")) || "simulated") as any, provider: text(formData.get("provider")) || "mock", providerReference: text(formData.get("providerReference")) || `mock-${Date.now()}` });
    revalidatePath("/admin/sms");
    return;
  }
  await ensureSeeded();
  await query(
    `insert into sms_logs (bill_id, unit_id, mobile, message, status, provider, provider_reference, sent_at) values ($1,$2,$3,$4,$5,$6,$7,now())`,
    [text(formData.get("billId")) || null, text(formData.get("unitId")) || null, text(formData.get("mobile")), text(formData.get("message")), text(formData.get("status")) || "simulated", text(formData.get("provider")) || "mock", text(formData.get("providerReference")) || `mock-${Date.now()}`]
  );
  revalidatePath("/admin/sms");
}

export async function saveReminderForBill(billId: string) {
  if (!hasDatabaseUrl()) {
    addDemoSmsLog({ billId, mobile: "No mobile", message: "Reminder: your Yardle electricity bill has an outstanding balance.", provider: "mock" });
    revalidatePath("/admin/sms");
    revalidatePath("/admin/landlord");
    return;
  }
  await ensureSeeded();
  const result = await query(
    `select b.id as bill_id, b.rounded_total_pence, b.remaining_balance_pence, u.id as unit_id, u.tenant_mobile, bp.name as period_name
     from bills b
     join units u on u.id = b.unit_id
     join billing_periods bp on bp.id = b.billing_period_id
     where b.id = $1`,
    [billId]
  );
  const row = result.rows[0];
  if (!row || row.remaining_balance_pence <= 0) return;
  const amount = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(row.remaining_balance_pence / 100);
  await query(
    `insert into sms_logs (bill_id, unit_id, mobile, message, status, provider, provider_reference, sent_at)
     values ($1,$2,$3,$4,'simulated','mock',$5,now())`,
    [row.bill_id, row.unit_id, row.tenant_mobile || "No mobile", `Reminder: your Yardle electricity bill for ${row.period_name} has ${amount} outstanding.`, `mock-${Date.now()}`]
  );
  revalidatePath("/admin/sms");
  revalidatePath("/admin/landlord");
}
export async function regenerateTenantBillLink(formData: FormData) {
  const unitId = text(formData.get("unitId"));
  const token = createTenantAccessToken();
  if (!hasDatabaseUrl()) {
    regenerateDemoTenantAccessToken(unitId, token);
  } else {
    await ensureSeeded();
    await query(
      "update units set tenant_access_token=$1, tenant_access_token_created_at=now(), tenant_access_enabled=true where id=$2",
      [token, unitId]
    );
  }
  revalidatePath(`/admin/units/${unitId}`);
  revalidatePath(`/admin/units/${unitId}/edit`);
  revalidatePath("/admin/units");
}

export async function sendTenantBillLinkSms(formData: FormData) {
  const unitId = text(formData.get("unitId"));
  if (!hasDatabaseUrl()) {
    const data = await getAppData();
    const unit = data.units.find((item) => item.id === unitId);
    const bill = data.bills.find((item) => item.unitId === unitId);
    const period = bill ? data.billingPeriods.find((item) => item.id === bill.billingPeriodId) : undefined;
    if (!unit?.tenantAccessEnabled || !unit.tenantAccessToken || !bill || !period) return;
    addDemoSmsLog({
      billId: bill.id,
      unitId,
      mobile: unit.tenantMobile || "No mobile",
      message: buildBillSms(period, bill, getTenantBillUrl(unit.tenantAccessToken)),
      provider: "mock"
    });
  } else {
    await ensureSeeded();
    const result = await query(
      `select u.id as unit_id, u.tenant_mobile, u.tenant_access_token, u.tenant_access_enabled,
              b.id as bill_id, b.rounded_total_pence, bp.name as period_name
       from units u
       join bills b on b.unit_id = u.id
       join billing_periods bp on bp.id = b.billing_period_id
       where u.id = $1
       order by b.issued_at desc nulls last, b.created_at desc
       limit 1`,
      [unitId]
    );
    const row = result.rows[0];
    if (!row?.tenant_access_enabled || !row.tenant_access_token) return;
    const message = `Your Yardle electricity bill for ${row.period_name} is ready. Total due: ${new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(row.rounded_total_pence / 100)}. View it here: ${getTenantBillUrl(row.tenant_access_token)}`;
    await query(
      `insert into sms_logs (bill_id, unit_id, mobile, message, status, provider, provider_reference, sent_at)
       values ($1,$2,$3,$4,'simulated','mock',$5,now())`,
      [row.bill_id, row.unit_id, row.tenant_mobile || "No mobile", message, `mock-${Date.now()}`]
    );
  }
  revalidatePath("/admin/sms");
  revalidatePath(`/admin/units/${unitId}/edit`);
}
