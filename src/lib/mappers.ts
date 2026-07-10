import type { Bill, BillingPeriod, Estate, MeterReading, Payment, SmsLog, Unit, User } from "./types";

export function mapUser(row: any): User {
  return { id: row.id, name: row.name, email: row.email, mobile: row.mobile ?? "", role: row.role, createdAt: row.created_at?.toISOString?.() ?? String(row.created_at) };
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
    createdAt: row.created_at?.toISOString?.() ?? String(row.created_at)
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
    tenantAccessTokenCreatedAt: row.tenant_access_token_created_at ? row.tenant_access_token_created_at?.toISOString?.() ?? String(row.tenant_access_token_created_at) : undefined,
    tenantAccessEnabled: Boolean(row.tenant_access_enabled),
    createdAt: row.created_at?.toISOString?.() ?? String(row.created_at)
  };
}

export function mapBillingPeriod(row: any): BillingPeriod {
  return {
    id: row.id,
    estateId: row.estate_id,
    name: row.name,
    startDate: row.start_date?.toISOString?.().slice(0, 10) ?? String(row.start_date).slice(0, 10),
    endDate: row.end_date?.toISOString?.().slice(0, 10) ?? String(row.end_date).slice(0, 10),
    status: row.status,
    kwhRatePence: row.kwh_rate_pence,
    standingChargePence: row.standing_charge_pence,
    levyPence: row.levy_pence,
    createdBy: row.created_by ?? "",
    issuedAt: row.issued_at ? row.issued_at?.toISOString?.() ?? String(row.issued_at) : undefined,
    createdAt: row.created_at?.toISOString?.() ?? String(row.created_at)
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
    enteredAt: row.entered_at?.toISOString?.() ?? String(row.entered_at),
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
    paymentDate: row.payment_date ? row.payment_date?.toISOString?.().slice(0, 10) ?? String(row.payment_date).slice(0, 10) : undefined,
    adminNotes: row.admin_notes ?? undefined,
    tenantNotes: row.tenant_notes ?? undefined,
    pdfUrl: row.pdf_url ?? undefined,
    issuedAt: row.issued_at ? row.issued_at?.toISOString?.() ?? String(row.issued_at) : undefined,
    smsSentAt: row.sms_sent_at ? row.sms_sent_at?.toISOString?.() ?? String(row.sms_sent_at) : undefined,
    createdAt: row.created_at?.toISOString?.() ?? String(row.created_at)
  };
}

export function mapPayment(row: any): Payment {
  return {
    id: row.id,
    billId: row.bill_id,
    unitId: row.unit_id,
    amountPence: row.amount_pence,
    paymentMethod: row.payment_method,
    paymentDate: row.payment_date?.toISOString?.().slice(0, 10) ?? String(row.payment_date).slice(0, 10),
    notes: row.notes ?? undefined,
    recordedBy: row.recorded_by ?? "",
    reversedAt: row.reversed_at ? row.reversed_at?.toISOString?.() ?? String(row.reversed_at) : undefined,
    reversedBy: row.reversed_by ?? undefined,
    reversalReason: row.reversal_reason ?? undefined,
    createdAt: row.created_at?.toISOString?.() ?? String(row.created_at)
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
    sentAt: row.sent_at ? row.sent_at?.toISOString?.() ?? String(row.sent_at) : undefined,
    createdAt: row.created_at?.toISOString?.() ?? String(row.created_at)
  };
}


