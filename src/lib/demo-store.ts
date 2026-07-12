import { calculateBill, calculateUsage } from "./billing";
import { getTenantBillUrl } from "./secure-link";
import { buildBillSms } from "./sms";
import { nextPeriodDetails } from "./period-cycle";
import { bills, billingPeriods, estate, meterReadings, payments, smsLogs, units, users } from "./demo-data";
import type { AppData } from "./data";
import type { BillingPeriod, PaymentMethod } from "./types";

const demoData: AppData = {
  users: users.map((item) => ({ ...item })),
  estate: { ...estate },
  units: units.map((item) => ({ ...item })),
  billingPeriods: billingPeriods.map((item) => ({ ...item })),
  meterReadings: meterReadings.map((item) => ({ ...item })),
  bills: bills.map((item) => ({ ...item })),
  payments: payments.map((item) => ({ ...item })),
  smsLogs: smsLogs.map((item) => ({ ...item }))
};

export function getDemoAppData(): AppData {
  return demoData;
}

export function getDemoBillById(id: string) {
  return demoData.bills.find((bill) => bill.id === id);
}

export function getDemoUnitById(id: string) {
  return demoData.units.find((unit) => unit.id === id);
}

export function getDemoUnitByAccessToken(token: string) {
  return demoData.units.find((unit) => unit.tenantAccessEnabled && unit.tenantAccessToken === token);
}

export function regenerateDemoTenantAccessToken(unitId: string, token: string) {
  const unit = demoData.units.find((item) => item.id === unitId);
  if (!unit) return;
  unit.tenantAccessToken = token;
  unit.tenantAccessTokenCreatedAt = new Date().toISOString();
  unit.tenantAccessEnabled = true;
}

export function getDemoBillingPeriodById(id: string) {
  return demoData.billingPeriods.find((period) => period.id === id);
}

export function saveDemoUnit(unitId: string, update: Partial<(typeof demoData.units)[number]>) {
  const existingIndex = demoData.units.findIndex((unit) => unit.id === unitId);
  if (existingIndex >= 0) {
    demoData.units[existingIndex] = { ...demoData.units[existingIndex], ...update };
    return demoData.units[existingIndex];
  }

  const unit = {
    id: `demo-unit-${Date.now()}`,
    estateId: demoData.estate.id,
    unitReference: update.unitReference ?? "New",
    tenantName: update.tenantName ?? "",
    tenantContactName: update.tenantContactName ?? "",
    tenantEmail: update.tenantEmail ?? "",
    tenantMobile: update.tenantMobile ?? "",
    status: update.status ?? "active",
    notes: update.notes,
    freeSupplyMeter: update.freeSupplyMeter ?? false,
    customKwhRatePence: update.customKwhRatePence,
    customStandingChargePence: update.customStandingChargePence,
    openingBalancePence: update.openingBalancePence ?? 0,
    currentBalancePence: update.currentBalancePence ?? 0,
    tenantAccessToken: update.tenantAccessToken ?? `demo_${Date.now()}_W8Kf4vQp2N7xR9mT6cL3sH5jD1zB0yUeA`,
    tenantAccessTokenCreatedAt: update.tenantAccessTokenCreatedAt ?? new Date().toISOString(),
    tenantAccessEnabled: update.tenantAccessEnabled ?? false,
    createdAt: new Date().toISOString()
  };
  demoData.units.unshift(unit);
  return unit;
}

export function archiveDemoUnit(unitId: string) {
  const unit = demoData.units.find((item) => item.id === unitId);
  if (unit) {
    unit.status = "inactive";
  }
}

export function saveDemoEstate(update: Partial<typeof demoData.estate>) {
  Object.assign(demoData.estate, update);
}

export function saveDemoBillingPeriod(periodId: string, update: Partial<BillingPeriod>) {
  const existingIndex = demoData.billingPeriods.findIndex((period) => period.id === periodId);
  if (existingIndex >= 0) {
    if (demoData.billingPeriods[existingIndex].status === "locked") {
      return demoData.billingPeriods[existingIndex];
    }
    demoData.billingPeriods[existingIndex] = { ...demoData.billingPeriods[existingIndex], ...update };
    return demoData.billingPeriods[existingIndex];
  }

  const period: BillingPeriod = {
    id: `demo-period-${Date.now()}`,
    estateId: update.estateId ?? demoData.estate.id,
    name: update.name ?? "New billing period",
    startDate: update.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: update.endDate ?? new Date().toISOString().slice(0, 10),
    status: update.status ?? "draft",
    kwhRatePence: update.kwhRatePence ?? demoData.estate.defaultKwhRatePence,
    standingChargePence: update.standingChargePence ?? demoData.estate.defaultStandingChargePence,
    levyPence: update.levyPence ?? demoData.estate.defaultLevyPence,
    createdBy: update.createdBy ?? "user-admin",
    issuedAt: update.issuedAt,
    createdAt: new Date().toISOString()
  };
  demoData.billingPeriods.unshift(period);
  return period;
}

export function saveDemoMeterReading(input: { periodId: string; unitId: string; previous: number; current: number; isEstimated: boolean; readingNotes?: string; photoUrl?: string }) {
  const usage = calculateUsage(input.previous, input.current);
  const existingIndex = demoData.meterReadings.findIndex((reading) => reading.billingPeriodId === input.periodId && reading.unitId === input.unitId);
  const reading = {
    id: existingIndex >= 0 ? demoData.meterReadings[existingIndex].id : `demo-reading-${input.periodId}-${input.unitId}`,
    billingPeriodId: input.periodId,
    unitId: input.unitId,
    previousReading: input.previous,
    currentReading: input.current,
    usage,
    isEstimated: input.isEstimated,
    readingNotes: input.readingNotes,
    photoUrl: input.photoUrl,
    readingStatus: "confirmed" as const,
    enteredBy: "user-admin",
    enteredAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    demoData.meterReadings[existingIndex] = reading;
  } else {
    demoData.meterReadings.unshift(reading);
  }
  return reading;
}

export function createDemoBillsForPeriod(periodId: string) {
  const period = demoData.billingPeriods.find((item) => item.id === periodId);
  if (!period) return;
  if (period.status === "issued" || period.status === "locked") return;
  const requiredUnits = demoData.units.filter((unit) => unit.status === "active" && !unit.freeSupplyMeter);
  const completedIds = new Set(demoData.meterReadings.filter((reading) => reading.billingPeriodId === periodId).map((reading) => reading.unitId));
  const missing = requiredUnits.filter((unit) => !completedIds.has(unit.id));
  if (missing.length) throw new Error(`${missing.length} required meter readings are still missing.`);

  for (const unit of demoData.units.filter((item) => item.status === "active" || item.status === "empty")) {
    const reading = demoData.meterReadings.find((item) => item.billingPeriodId === periodId && item.unitId === unit.id);
    if (!reading) continue;
    const calculatedBill = calculateBill({ unit, period, reading });
    const existingIndex = demoData.bills.findIndex((bill) => bill.billingPeriodId === periodId && bill.unitId === unit.id);
    const bill = {
      ...calculatedBill,
      issuedAt: new Date().toISOString(),
      smsSentAt: new Date().toISOString(),
      createdAt: existingIndex >= 0 ? demoData.bills[existingIndex].createdAt : new Date().toISOString()
    };

    if (existingIndex >= 0) {
      demoData.bills[existingIndex] = { ...demoData.bills[existingIndex], ...bill };
    } else {
      demoData.bills.unshift(bill);
    }
    if (unit.tenantAccessEnabled && unit.tenantAccessToken && unit.tenantMobile) {
      addDemoSmsLog({ billId: bill.id, unitId: unit.id, mobile: unit.tenantMobile, message: buildBillSms(period, bill, getTenantBillUrl(unit.tenantAccessToken)), provider: "mock" });
    }
  }
  period.status = "locked";
  period.issuedAt = new Date().toISOString();
  if (!demoData.billingPeriods.some((item) => item.status === "draft" && item.id !== period.id)) {
    saveDemoBillingPeriod("", nextPeriodDetails(period));
  }
}

export function saveDemoPaymentUpdate(input: { billId: string; amountPaidPence: number; paymentMethod: string; paymentDate: string; notes: string }) {
  const bill = demoData.bills.find((item) => item.id === input.billId);
  if (!bill) return;

  const remaining = bill.roundedTotalPence - input.amountPaidPence;
  bill.amountPaidPence = input.amountPaidPence;
  bill.remainingBalancePence = remaining;
  bill.paidStatus = remaining < 0 ? "credited" : remaining === 0 ? "paid" : input.amountPaidPence > 0 ? "part_paid" : "unpaid";
  bill.paymentDate = input.paymentDate || undefined;
  bill.adminNotes = input.notes || undefined;

  const unit = demoData.units.find((item) => item.id === bill.unitId);
  if (unit) {
    unit.currentBalancePence = remaining;
  }

  for (let index = demoData.payments.length - 1; index >= 0; index -= 1) {
    if (demoData.payments[index].billId === bill.id) {
      demoData.payments.splice(index, 1);
    }
  }

  const normalized = input.paymentMethod.toLowerCase().replaceAll(" ", "_");
  const method: PaymentMethod = normalized === "cash" || normalized === "bank_transfer" || normalized === "card" ? normalized : "other";
  if (input.amountPaidPence > 0 && input.paymentDate && input.paymentMethod) {
    demoData.payments.unshift({
      id: `demo-payment-${Date.now()}`,
      billId: bill.id,
      unitId: bill.unitId,
      amountPence: input.amountPaidPence,
      paymentMethod: method,
      paymentDate: input.paymentDate,
      notes: input.notes || undefined,
      recordedBy: "user-admin",
      createdAt: new Date().toISOString()
    });
  }
}

export function addDemoSmsLog(input: { billId?: string; unitId?: string; mobile: string; message: string; status?: "queued" | "sent" | "failed" | "simulated"; provider?: string; providerReference?: string; failureReason?: string }) {
  demoData.smsLogs.unshift({
    id: `demo-sms-${Date.now()}`,
    billId: input.billId ?? "",
    unitId: input.unitId ?? "",
    mobile: input.mobile,
    message: input.message,
    status: input.status ?? "simulated",
    provider: input.provider ?? "mock",
    providerReference: input.providerReference ?? `mock-${Date.now()}`,
    failureReason: input.failureReason,
    sentAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  });
}



