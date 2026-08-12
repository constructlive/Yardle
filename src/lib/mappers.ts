import type { Bill, BillingPeriod, Estate, MeterReading, Payment, RentCharge, RentPayment, RentSetting, SmsLog, Unit, User } from "./types";

function safeDateTime(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  const text = String(value).trim();
  if (!text || text.startsWith("0000-00-00")) return undefined;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function safeDate(value: unknown): string | undefined {
  const dateTime = safeDateTime(value);
  return dateTime?.slice(0, 10);
}

function requiredDateTime(value: unknown) {
  return safeDateTime(value) ?? new Date(0).toISOString();
}

function requiredDate(value: unknown) {
  return safeDate(value) ?? "";
}

export function mapUser(row: any): User {
  return { id: row.id, name: row.name, email: row.email, mobile: row.mobile ?? "", role: row.role, createdAt: requiredDateTime(row.created_at) };
}

export function mapEstate(row: any): Estate {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone ?? "",
    logoUrl: row.logo_url ?? undefined,
    defaultKwhRatePence: row.default_kwh_rate_pence,
    defaultStandingChargePence: row.default_standing_charge_pence,
    defaultLevyPence: row.default_levy_pence,
    currency: row.currency,
    smsSenderName: row.sms_sender_name,
    createdAt: requiredDateTime(row.created_at)
  };
}

export function mapUnit(row: any): Unit {
  return {
    id: row.id,
    estateId: row.estate_id,
    unitReference: row.unit_reference,
    tenantName: row.tenant_name ?? "",
    tenantContactName: row.tenant_contact_name ?? "",
    tenantEmail: row.tenant_email ?? "",
    tenantMobile: row.tenant_mobile ?? "",
    status: row.status,
    notes: row.notes ?? undefined,
    freeSupplyMeter: Boolean(row.free_supply_meter),
    customKwhRatePence: row.custom_kwh_rate_pence ?? undefined,
    customStandingChargePence: row.custom_standing_charge_pence ?? undefined,
    openingBalancePence: row.opening_balance_pence,
    currentBalancePence: row.current_balance_pence,
    tenantAccessToken: row.tenant_access_token ?? "",
    tenantAccessTokenCreatedAt: safeDateTime(row.tenant_access_token_created_at),
    tenantAccessEnabled: Boolean(row.tenant_access_enabled),
    createdAt: requiredDateTime(row.created_at)
  };
}

export function mapBillingPeriod(row: any): BillingPeriod {
  return {
    id: row.id,
    estateId: row.estate_id,
    name: row.name,
    startDate: requiredDate(row.start_date),
    endDate: requiredDate(row.end_date),
    status: row.status,
    kwhRatePence: row.kwh_rate_pence,
    standingChargePence: row.standing_charge_pence,
    levyPence: row.levy_pence,
    createdBy: row.created_by ?? "",
    issuedAt: safeDateTime(row.issued_at),
    createdAt: requiredDateTime(row.created_at)
  };
}

export function mapMeterReading(row: any): MeterReading {
  return {
    id: row.id,
    billingPeriodId: row.billing_period_id,
    unitId: row.unit_id,
    previousReading: Number(row.previous_reading),
    currentReading: Number(row.current_reading),
    usage: Number(row.usage),
    isEstimated: Boolean(row.is_estimated),
    readingNotes: row.reading_notes ?? undefined,
    readingStatus: row.reading_status,
    enteredBy: row.entered_by ?? "",
    enteredAt: requiredDateTime(row.entered_at),
    photoUrl: row.photo_url ?? undefined
  };
}

export function mapBill(row: any): Bill {
  return {
    id: row.id,
    billingPeriodId: row.billing_period_id,
    unitId: row.unit_id,
    previousReading: Number(row.previous_reading),
    currentReading: Number(row.current_reading),
    usage: Number(row.usage),
    kwhRatePence: row.kwh_rate_pence,
    standingChargePence: row.standing_charge_pence,
    levyPence: row.levy_pence,
    usageCostPence: row.usage_cost_pence,
    subtotalPence: row.subtotal_pence,
    outstandingCarriedForwardPence: row.outstanding_carried_forward_pence,
    totalDuePence: row.total_due_pence,
    roundedTotalPence: row.rounded_total_pence,
    amountPaidPence: row.amount_paid_pence,
    remainingBalancePence: row.remaining_balance_pence,
    paidStatus: row.paid_status,
    paymentDate: safeDate(row.payment_date),
    adminNotes: row.admin_notes ?? undefined,
    tenantNotes: row.tenant_notes ?? undefined,
    pdfUrl: row.pdf_url ?? undefined,
    issuedAt: safeDateTime(row.issued_at),
    smsSentAt: safeDateTime(row.sms_sent_at),
    createdAt: requiredDateTime(row.created_at)
  };
}

export function mapPayment(row: any): Payment {
  return {
    id: row.id,
    billId: row.bill_id,
    unitId: row.unit_id,
    amountPence: row.amount_pence,
    paymentMethod: row.payment_method,
    paymentDate: requiredDate(row.payment_date),
    notes: row.notes ?? undefined,
    recordedBy: row.recorded_by ?? "",
    reversedAt: safeDateTime(row.reversed_at),
    reversedBy: row.reversed_by ?? undefined,
    reversalReason: row.reversal_reason ?? undefined,
    createdAt: requiredDateTime(row.created_at)
  };
}

export function mapSmsLog(row: any): SmsLog {
  return {
    id: row.id,
    billId: row.bill_id ?? "",
    unitId: row.unit_id ?? "",
    mobile: row.mobile,
    message: row.message,
    status: row.status,
    provider: row.provider,
    providerReference: row.provider_reference ?? "",
    failureReason: row.failure_reason ?? undefined,
    sentAt: safeDateTime(row.sent_at),
    createdAt: requiredDateTime(row.created_at)
  };
}
export function mapRentSetting(row: any): RentSetting {
  return {
    id: row.id,
    unitId: row.unit_id,
    enabled: Boolean(row.enabled),
    frequency: row.frequency,
    amountPence: Number(row.amount_pence ?? 0),
    startDate: requiredDate(row.start_date),
    dueDayOfMonth: row.due_day_of_month === null || row.due_day_of_month === undefined ? undefined : Number(row.due_day_of_month),
    notes: row.notes ?? undefined,
    createdAt: requiredDateTime(row.created_at),
    updatedAt: requiredDateTime(row.updated_at)
  };
}

export function mapRentCharge(row: any): RentCharge {
  return {
    id: row.id,
    unitId: row.unit_id,
    dueDate: requiredDate(row.due_date),
    amountPence: Number(row.amount_pence ?? 0),
    status: row.status,
    notes: row.notes ?? undefined,
    createdAt: requiredDateTime(row.created_at)
  };
}

export function mapRentPayment(row: any): RentPayment {
  return {
    id: row.id,
    unitId: row.unit_id,
    amountPence: Number(row.amount_pence ?? 0),
    paymentMethod: row.payment_method,
    paymentDate: requiredDate(row.payment_date),
    notes: row.notes ?? undefined,
    recordedBy: row.recorded_by ?? "",
    reversedAt: safeDateTime(row.reversed_at),
    reversedBy: row.reversed_by ?? undefined,
    reversalReason: row.reversal_reason ?? undefined,
    createdAt: requiredDateTime(row.created_at)
  };
}