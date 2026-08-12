"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { calculateUsage } from "./billing";
import { paymentTotals } from "./payment-accounting";
import { createBillsForPeriod, getAppData } from "./data";
import { ensureSeeded, hasDatabaseUrl, query, transaction } from "./db";
import { serializeTenantMeta } from "./tenant-meta";
import { createTenantAccessToken, getTenantBillUrl } from "./secure-link";
import { renderSmsTemplate, saveSmsTemplate } from "./sms-templates";
import { savePaymentInstructions } from "./payment-instructions";
import { getRentDueDates, normaliseRentFrequency } from "./rent";
import { sendAndLogSms } from "./sms-logging";
import { commitHistoricalImport, previewHistoricalImport, type HistoricalImportCommitState, type HistoricalImportPreviewState, type HistoricalImportPreviewRow } from "./historical-import";
import { requireAdminSession } from "./session";
import { addDemoRentCharges, archiveDemoUnit, regenerateDemoTenantAccessToken, saveDemoBillingPeriod, saveDemoEstate, saveDemoMeterReading, saveDemoPaymentUpdate, saveDemoRentPayment, saveDemoRentSetting, saveDemoUnit } from "./demo-store";
import type { PaymentMethod } from "./types";
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

export async function previewHistoricalImportAction(_previousState: HistoricalImportPreviewState, formData: FormData): Promise<HistoricalImportPreviewState> {
  await requireAdminSession();
  try {
    const data = await getAppData();
    const fallbackYearRaw = text(formData.get("fallbackYear"));
    const fallbackYear = fallbackYearRaw ? Number(fallbackYearRaw) : undefined;
    const fileValues = formData.getAll("files").filter(isUploadedFile);
    if (!fileValues.length) {
      return { ok: false, message: "Choose at least one CSV, XLS or XLSX file before uploading.", rows: [], summaries: [] };
    }
    const files = await Promise.all(
      fileValues.map(async (file) => ({
        name: String(file.name || "upload"),
        buffer: Buffer.from(await file.arrayBuffer())
      }))
    );
    return previewHistoricalImport({ files, units: data.units, fallbackYear: fallbackYear && Number.isFinite(fallbackYear) ? fallbackYear : undefined });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? `Import preview failed: ${error.message}` : "Import preview failed. Please check the file format and try again.", rows: [], summaries: [] };
  }
}

function isUploadedFile(value: FormDataEntryValue): value is File {
  return typeof value === "object" && value !== null && "arrayBuffer" in value && "name" in value && "size" in value && Number((value as File).size) > 0;
}

export async function confirmHistoricalImportAction(_previousState: HistoricalImportCommitState, formData: FormData): Promise<HistoricalImportCommitState> {
  const session = await requireAdminSession();
  const data = await getAppData();
  const rowsJson = text(formData.get("rows"));
  if (!rowsJson) return { ok: false, message: "Preview the import before confirming.", imported: 0, skipped: 0, duplicate: 0, failed: 0 };
  try {
    const rows = JSON.parse(rowsJson) as HistoricalImportPreviewRow[];
    const result = await commitHistoricalImport({ rows, estateId: data.estate.id, session });
    revalidatePath("/admin/import");
    return result;
  } catch {
    return { ok: false, message: "The import preview could not be read. Please preview the files again.", imported: 0, skipped: 0, duplicate: 0, failed: 0 };
  }
}
export async function saveEstateSettings(formData: FormData) {
  await requireAdminSession();
  if (!hasDatabaseUrl()) {
    saveDemoEstate({ name: text(formData.get("name")), contactEmail: text(formData.get("contactEmail")), contactPhone: text(formData.get("contactPhone")), smsSenderName: text(formData.get("smsSenderName")), defaultKwhRatePence: pence(formData.get("defaultKwhRate")) ?? 0, defaultStandingChargePence: pence(formData.get("defaultStandingCharge")) ?? 0, defaultLevyPence: pence(formData.get("defaultLevy")) ?? 0, address: text(formData.get("address")) });
    revalidatePath("/admin/settings");
    return;
  }
  await ensureSeeded();
  await query(
    `update estates set name = ?, contact_email = ?, contact_phone = ?, sms_sender_name = ?, default_kwh_rate_pence = ?, default_standing_charge_pence = ?, default_levy_pence = ?, address = ? where id = ?`,
    [text(formData.get("name")), text(formData.get("contactEmail")), text(formData.get("contactPhone")), text(formData.get("smsSenderName")), pence(formData.get("defaultKwhRate")) ?? 0, pence(formData.get("defaultStandingCharge")) ?? 0, pence(formData.get("defaultLevy")) ?? 0, text(formData.get("address")), text(formData.get("estateId"))]
  );
  revalidatePath("/admin/settings");
}

export async function savePaymentInstructionsAction(formData: FormData) {
  await requireAdminSession();
  await savePaymentInstructions(text(formData.get("paymentInstructions")));
  revalidatePath("/admin/settings");
  revalidatePath("/bill");
}
export async function saveUnit(formData: FormData) {
  await requireAdminSession();
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
      `update units set estate_id=?, unit_reference=?, tenant_name=?, tenant_contact_name=?, tenant_email=?, tenant_mobile=?, status=?, notes=?, free_supply_meter=?, custom_kwh_rate_pence=?, custom_standing_charge_pence=?, opening_balance_pence=?, current_balance_pence=?, tenant_access_enabled=? where id=?`,
      [...params, unitId]
    );
  } else {
    await query(
      `insert into units (id, estate_id, unit_reference, tenant_name, tenant_contact_name, tenant_email, tenant_mobile, status, notes, free_supply_meter, custom_kwh_rate_pence, custom_standing_charge_pence, opening_balance_pence, current_balance_pence, tenant_access_enabled, tenant_access_token, tenant_access_token_created_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,utc_timestamp())`,
      [randomUUID(), ...params, createTenantAccessToken()]
    );
  }
  revalidatePath("/admin/units");
}

export async function archiveUnit(formData: FormData) {
  await requireAdminSession();
  if (!hasDatabaseUrl()) {
    archiveDemoUnit(text(formData.get("unitId")));
    revalidatePath("/admin/units");
    return;
  }
  await ensureSeeded();
  await query("update units set status = 'inactive' where id = ?", [text(formData.get("unitId"))]);
  revalidatePath("/admin/units");
}

export async function saveBillingPeriod(formData: FormData) {
  await requireAdminSession();
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
    await query("update billing_periods set name=?, start_date=?, end_date=?, kwh_rate_pence=?, standing_charge_pence=?, levy_pence=? where id=? and status != 'locked'", [...params, periodId]);
  } else {
    await query("insert into billing_periods (id, estate_id, name, start_date, end_date, status, kwh_rate_pence, standing_charge_pence, levy_pence) values (?,?,?,?,?,'draft',?,?,?)", [randomUUID(), estateId, ...params]);
  }
  revalidatePath("/admin/periods");
}

export async function saveMeterReading(formData: FormData) {
  await requireAdminSession();
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
    `insert into meter_readings (id, billing_period_id, unit_id, previous_reading, current_reading, \`usage\`, is_estimated, reading_notes, reading_status, entered_by, entered_at, photo_url)
     values (?,?,?,?,?,?,?,?,'confirmed',(select id from users where role in ('super_admin','admin') order by created_at limit 1),utc_timestamp(),?)
     on duplicate key update previous_reading=values(previous_reading), current_reading=values(current_reading), \`usage\`=values(\`usage\`), is_estimated=values(is_estimated), reading_notes=values(reading_notes), reading_status='confirmed', entered_by=(select id from users where role in ('super_admin','admin') order by created_at limit 1), entered_at=utc_timestamp(), photo_url=values(photo_url)`,
    [randomUUID(), text(formData.get("periodId")), text(formData.get("unitId")), previous, current, usage, bool(formData.get("isEstimated")), text(formData.get("readingNotes")) || null, text(formData.get("photoUrl")) || null]
  );
  revalidatePath("/admin/readings");
  revalidatePath("/admin/bills/review");
}

export async function issueBills(formData: FormData) {
  await requireAdminSession();
  const periodId = text(formData.get("periodId"));
  try {
    await createBillsForPeriod(periodId);
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "Bills could not be issued.";
    redirect(`/admin/bills/review?periodId=${encodeURIComponent(periodId)}&error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/bills");
  revalidatePath("/admin/bills/review");
  revalidatePath("/admin/periods");
  revalidatePath("/admin/readings");
  revalidatePath("/admin");
  redirect("/admin/bills");
}

export async function savePaymentUpdate(input: { billId: string; amountPaidPence: number; paymentMethod: string; paymentDate: string; notes: string }) {
  const session = await requireAdminSession();
  if (!hasDatabaseUrl()) {
    saveDemoPaymentUpdate(input);
    const receipt = await sendPaymentReceiptSms(input.billId, Math.max(0, input.amountPaidPence));
    revalidatePath("/admin/payments");
    revalidatePath("/admin/landlord");
    revalidatePath("/admin/bills");
    revalidatePath("/admin/sms");
    return { ok: true, message: receipt.message ? `Payment saved in Demo Mode. ${receipt.message}` : "Payment saved in Demo Mode." };
  }
  await ensureSeeded();
  const normalized = input.paymentMethod.trim().toLowerCase().replaceAll(" ", "_");
  const method = normalized === "cheque" ? "other" : normalized;
  if (input.amountPaidPence < 0) return { ok: false, message: "Payment amount cannot be negative." };
  if (input.amountPaidPence > 0 && !method) return { ok: false, message: "Choose a payment method before saving payment." };
  if (input.amountPaidPence > 0 && !input.paymentDate) return { ok: false, message: "Choose a payment date before saving payment." };

  let response = { ok: true, message: "Payment saved." };
  let receiptRequest: { billId: string; amountPence: number } | undefined;
  await transaction(async (client) => {
    const billResult = await client.query("select * from bills where id = ? for update", [input.billId]);
    const bill = billResult.rows[0];
    if (!bill) {
      response = { ok: false, message: "Bill not found." };
      return;
    }
    const paymentsResult = await client.query("select * from payments where bill_id = ? and reversed_at is null for update", [input.billId]);
    const currentPaid = paymentsResult.rows.reduce((sum, payment) => sum + Number(payment.amount_pence), 0);
    const desiredPaid = input.amountPaidPence;
    const delta = desiredPaid - currentPaid;
    if (delta < 0) {
      response = { ok: false, message: "Use Reverse payment to reduce a recorded payment." };
      return;
    }
    if (delta > 0) {
      await client.query(
        `insert into payments (id, bill_id, unit_id, amount_pence, payment_method, payment_date, notes, recorded_by)
         values (?,?,?,?,?,?,?,?)`,
        [randomUUID(), input.billId, bill.unit_id, delta, method || "other", input.paymentDate, input.notes || null, session.userId]
      );
      receiptRequest = { billId: input.billId, amountPence: delta };
    }
    const updatedPayments = await client.query("select * from payments where bill_id = ? and reversed_at is null", [input.billId]);
    const active = updatedPayments.rows.map((payment) => ({ id: payment.id, billId: payment.bill_id, unitId: payment.unit_id, amountPence: Number(payment.amount_pence), paymentMethod: payment.payment_method, paymentDate: String(payment.payment_date).slice(0, 10), notes: payment.notes ?? undefined, recordedBy: payment.recorded_by ?? "", createdAt: String(payment.created_at) }));
    const totals = paymentTotals(Number(bill.rounded_total_pence), active as any);
    await client.query("update bills set amount_paid_pence=?, remaining_balance_pence=?, paid_status=?, payment_date=?, admin_notes=? where id=?", [totals.amountPaidPence, totals.remainingBalancePence, totals.paidStatus, totals.paymentDate || null, input.notes || null, input.billId]);
    await client.query("update units set current_balance_pence=? where id=?", [totals.remainingBalancePence, bill.unit_id]);
  });
  if (response.ok && receiptRequest) {
    const receipt = await sendPaymentReceiptSms(receiptRequest.billId, receiptRequest.amountPence);
    response = { ok: true, message: receipt.message ? `Payment saved. ${receipt.message}` : "Payment saved." };
  }
  revalidatePath("/admin/payments");
  revalidatePath("/admin/landlord");
  revalidatePath("/admin/bills");
  revalidatePath("/admin/sms");
  return response;
}

async function sendPaymentReceiptSms(billId: string, amountPence: number) {
  if (amountPence <= 0) return { message: "" };
  const data = await getAppData();
  const bill = data.bills.find((item) => item.id === billId);
  const unit = bill ? data.units.find((item) => item.id === bill.unitId) : undefined;
  const period = bill ? data.billingPeriods.find((item) => item.id === bill.billingPeriodId) : undefined;
  if (!bill || !unit) return { message: "Payment receipt SMS not sent: bill or tenant could not be found." };
  if (!unit.tenantMobile) return { message: "Payment receipt SMS not sent: no mobile number is saved." };

  try {
    const log = await sendAndLogSms({
      billId: bill.id,
      unitId: unit.id,
      mobile: unit.tenantMobile,
      message: await renderSmsTemplate("payment_received", {
        estateName: data.estate.name,
        tenantName: unit.tenantName || "Tenant",
        unitNumber: unit.unitReference,
        billType: period?.name || "your Yardle bill",
        amount: new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amountPence / 100),
        dueDate: period?.endDate || "",
        paymentLink: unit.tenantAccessEnabled && unit.tenantAccessToken ? getTenantBillUrl(unit.tenantAccessToken) : ""
      })
    });
    if (log.status === "failed") return { message: `Payment receipt SMS failed: ${log.failureReason || "provider rejected the message."}` };
    return { message: `Payment receipt SMS ${log.status === "simulated" ? "simulated" : "sent"} to ${log.mobile}.` };
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "SMS provider request failed.";
    return { message: `Payment receipt SMS failed: ${message}` };
  }
}
export async function reversePayment(input: { paymentId: string; reason?: string }) {
  const session = await requireAdminSession();
  if (!hasDatabaseUrl()) {
    return { ok: false, message: "Payment reversal is available when Yardle is connected to MariaDB." };
  }
  await ensureSeeded();
  let response = { ok: true, message: "Payment reversed." };
  await transaction(async (client) => {
    const paymentResult = await client.query("select * from payments where id = ? for update", [input.paymentId]);
    const payment = paymentResult.rows[0];
    if (!payment) {
      response = { ok: false, message: "Payment not found." };
      return;
    }
    if (payment.reversed_at) {
      response = { ok: false, message: "This payment has already been reversed." };
      return;
    }
    const billResult = await client.query("select * from bills where id = ? for update", [payment.bill_id]);
    const bill = billResult.rows[0];
    if (!bill) {
      response = { ok: false, message: "Bill not found." };
      return;
    }
    await client.query("update payments set reversed_at=utc_timestamp(), reversed_by=?, reversal_reason=? where id=? and reversed_at is null", [session.userId, input.reason || "Landlord correction", input.paymentId]);
    const activeResult = await client.query("select * from payments where bill_id = ? and reversed_at is null", [payment.bill_id]);
    const active = activeResult.rows.map((item) => ({ id: item.id, billId: item.bill_id, unitId: item.unit_id, amountPence: Number(item.amount_pence), paymentMethod: item.payment_method, paymentDate: String(item.payment_date).slice(0, 10), notes: item.notes ?? undefined, recordedBy: item.recorded_by ?? "", createdAt: String(item.created_at) }));
    const totals = paymentTotals(Number(bill.rounded_total_pence), active as any);
    await client.query("update bills set amount_paid_pence=?, remaining_balance_pence=?, paid_status=?, payment_date=? where id=?", [totals.amountPaidPence, totals.remainingBalancePence, totals.paidStatus, totals.paymentDate || null, payment.bill_id]);
    await client.query("update units set current_balance_pence=? where id=?", [totals.remainingBalancePence, bill.unit_id]);
  });
  revalidatePath("/admin/payments");
  revalidatePath("/admin/landlord");
  revalidatePath("/admin/bills");
  return response;
}

export async function saveSmsTemplateUpdate(input: { templateKey: string; body: string }) {
  await requireAdminSession();
  const result = await saveSmsTemplate(input);
  revalidatePath("/admin/settings");
  return result;
}

export async function saveSmsLog(formData: FormData) {
  await requireAdminSession();
  const log = await sendAndLogSms({
    billId: text(formData.get("billId")) || undefined,
    unitId: text(formData.get("unitId")) || undefined,
    mobile: text(formData.get("mobile")),
    message: text(formData.get("message")) || "Yardle test SMS"
  });
  revalidatePath("/admin/sms");
  return {
    ok: log.status !== "failed",
    status: log.status,
    provider: log.provider,
    providerReference: log.providerReference,
    failureReason: log.failureReason ?? "",
    recipient: log.mobile
  };
}

export async function sendTestSms(_previousState: unknown, formData: FormData) {
  return saveSmsLog(formData);
}
export async function saveReminderForBill(billId: string) {
  await requireAdminSession();
  const data = await getAppData();
  const bill = data.bills.find((item) => item.id === billId);
  if (!bill || bill.remainingBalancePence <= 0) return;
  const unit = data.units.find((item) => item.id === bill.unitId);
  const period = data.billingPeriods.find((item) => item.id === bill.billingPeriodId);
  const amount = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(bill.remainingBalancePence / 100);
  const paymentLink = unit?.tenantAccessToken ? getTenantBillUrl(unit.tenantAccessToken) : "";
  await sendAndLogSms({
    billId,
    unitId: unit?.id,
    mobile: unit?.tenantMobile || "No mobile",
    message: await renderSmsTemplate("payment_reminder", {
      estateName: data.estate.name,
      tenantName: unit?.tenantName || "Tenant",
      unitNumber: unit?.unitReference || "-",
      billType: period?.name || "your current bill",
      amount,
      dueDate: period?.endDate || "",
      paymentLink
    })
  });
  revalidatePath("/admin/sms");
  revalidatePath("/admin/landlord");
}
export async function regenerateTenantBillLink(formData: FormData) {
  await requireAdminSession();
  const unitId = text(formData.get("unitId"));
  const token = createTenantAccessToken();
  if (!hasDatabaseUrl()) {
    regenerateDemoTenantAccessToken(unitId, token);
  } else {
    await ensureSeeded();
    await query(
      "update units set tenant_access_token=?, tenant_access_token_created_at=utc_timestamp(), tenant_access_enabled=1 where id=?",
      [token, unitId]
    );
  }
  revalidatePath(`/admin/units/${unitId}`);
  revalidatePath(`/admin/units/${unitId}/edit`);
  revalidatePath("/admin/units");
}

export async function sendTenantBillLinkSms(input: FormData | string) {
  await requireAdminSession();
  const unitId = typeof input === "string" ? input : text(input.get("unitId"));
  const data = await getAppData();
  const unit = data.units.find((item) => item.id === unitId);
  if (!unit) return { ok: false, message: "Unit not found." };
  if (!unit.tenantAccessEnabled || !unit.tenantAccessToken) return { ok: false, message: "Online Bill Access is not enabled for this unit." };
  if (!unit.tenantMobile) return { ok: false, message: "No mobile number is saved for this tenant." };

  const bill = data.bills.find((item) => item.unitId === unitId);
  const period = bill ? data.billingPeriods.find((item) => item.id === bill.billingPeriodId) : undefined;
  const log = await sendAndLogSms({
    billId: bill?.id,
    unitId,
    mobile: unit.tenantMobile,
    message: await renderSmsTemplate("welcome", {
      estateName: data.estate.name,
      tenantName: unit.tenantName || "Tenant",
      unitNumber: unit.unitReference,
      billType: period?.name || "Online Bill Access",
      amount: bill ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(bill.roundedTotalPence / 100) : "",
      dueDate: period?.endDate || "",
      paymentLink: getTenantBillUrl(unit.tenantAccessToken)
    })
  });
  revalidatePath("/admin/sms");
  revalidatePath(`/admin/units/${unitId}/edit`);
  return {
    ok: log.status !== "failed",
    message: log.status === "failed" ? `SMS failed: ${log.failureReason || "provider rejected the message."}` : `SMS ${log.status === "simulated" ? "simulated" : "sent"} to ${log.mobile}.`
  };
}

export async function saveRentSetting(formData: FormData) {
  await requireAdminSession();
  const unitId = text(formData.get("unitId"));
  const enabled = bool(formData.get("enabled"));
  const frequency = normaliseRentFrequency(text(formData.get("frequency")));
  const amountPence = pence(formData.get("amount")) ?? 0;
  const startDate = text(formData.get("startDate")) || new Date().toISOString().slice(0, 10);
  const dueDayValue = Number(text(formData.get("dueDayOfMonth")) || "1");
  const dueDayOfMonth = frequency === "calendar_month" ? Math.min(28, Math.max(1, dueDayValue)) : undefined;
  const notes = text(formData.get("notes")) || undefined;

  if (!unitId) return;
  if (enabled && amountPence <= 0) return;

  if (!hasDatabaseUrl()) {
    saveDemoRentSetting({ unitId, enabled, frequency, amountPence, startDate, dueDayOfMonth, notes });
    revalidatePath("/admin/rent");
    revalidatePath("/admin/rent/settings");
    revalidatePath("/admin/rent/checklist");
    return;
  }

  await ensureSeeded();
  await query(
    `insert into rent_settings (id, unit_id, enabled, frequency, amount_pence, start_date, due_day_of_month, notes)
     values (?,?,?,?,?,?,?,?)
     on duplicate key update enabled=values(enabled), frequency=values(frequency), amount_pence=values(amount_pence), start_date=values(start_date), due_day_of_month=values(due_day_of_month), notes=values(notes), updated_at=utc_timestamp()`,
    [randomUUID(), unitId, enabled, frequency, amountPence, startDate, dueDayOfMonth ?? null, notes ?? null]
  );
  revalidatePath("/admin/rent");
  revalidatePath("/admin/rent/settings");
  revalidatePath("/admin/rent/checklist");
  return;
}

export async function generateRentCharges(formData?: FormData) {
  await requireAdminSession();
  const requestedUnitId = formData ? text(formData.get("unitId")) : "";
  const data = await getAppData();
  const settings = data.rentSettings.filter((setting) => setting.enabled && setting.amountPence > 0 && (!requestedUnitId || setting.unitId === requestedUnitId));
  let created = 0;

  if (!hasDatabaseUrl()) {
    for (const setting of settings) {
      const existing = new Set(data.rentCharges.filter((charge) => charge.unitId === setting.unitId).map((charge) => charge.dueDate));
      const dueDates = getRentDueDates(setting).filter((dueDate) => !existing.has(dueDate));
      addDemoRentCharges({ unitId: setting.unitId, dueDates, amountPence: setting.amountPence });
      created += dueDates.length;
    }
    revalidatePath("/admin/rent");
    revalidatePath("/admin/rent/checklist");
    return;
  }

  await ensureSeeded();
  for (const setting of settings) {
    const existing = new Set(data.rentCharges.filter((charge) => charge.unitId === setting.unitId).map((charge) => charge.dueDate));
    const dueDates = getRentDueDates(setting).filter((dueDate) => !existing.has(dueDate));
    for (const dueDate of dueDates) {
      await query(
        `insert into rent_charges (id, unit_id, due_date, amount_pence, status, notes)
         values (?,?,?,?, 'due', ?)
         on duplicate key update amount_pence=values(amount_pence)`,
        [randomUUID(), setting.unitId, dueDate, setting.amountPence, setting.frequency === "calendar_month" ? "Calendar monthly rent" : "Weekly Monday rent"]
      );
      created += 1;
    }
  }
  revalidatePath("/admin/rent");
  revalidatePath("/admin/rent/checklist");
  return;
}

export async function saveRentPayment(formData: FormData) {
  const session = await requireAdminSession();
  const unitId = text(formData.get("unitId"));
  const amountPence = pence(formData.get("amount")) ?? 0;
  const methodRaw = text(formData.get("paymentMethod")).toLowerCase().replaceAll(" ", "_");
  const paymentMethod: PaymentMethod = methodRaw === "cash" || methodRaw === "bank_transfer" || methodRaw === "card" ? methodRaw : "other";
  const paymentDate = text(formData.get("paymentDate")) || new Date().toISOString().slice(0, 10);
  const notes = text(formData.get("notes")) || undefined;

  if (!unitId) return;
  if (amountPence <= 0) return;

  if (!hasDatabaseUrl()) {
    saveDemoRentPayment({ unitId, amountPence, paymentMethod, paymentDate, notes });
    revalidatePath("/admin/rent");
    revalidatePath("/admin/rent/checklist");
    revalidatePath("/admin/rent/payments");
    return;
  }

  await ensureSeeded();
  await query(
    `insert into rent_payments (id, unit_id, amount_pence, payment_method, payment_date, notes, recorded_by)
     values (?,?,?,?,?,?,?)`,
    [randomUUID(), unitId, amountPence, paymentMethod, paymentDate, notes ?? null, session.userId]
  );
  revalidatePath("/admin/rent");
  revalidatePath("/admin/rent/checklist");
  revalidatePath("/admin/rent/payments");
  return;
}
