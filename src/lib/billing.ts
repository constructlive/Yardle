import type { Bill, BillingPeriod, MeterReading, Unit } from "./types";

export interface BillInput {
  unit: Unit;
  period: BillingPeriod;
  reading: MeterReading;
  outstandingOverridePence?: number;
  rateOverridePence?: number;
  standingChargeOverridePence?: number;
  adminNotes?: string;
}

export function calculateUsage(previousReading: number, currentReading: number): number {
  return Math.max(0, Number((currentReading - previousReading).toFixed(2)));
}

export function calculateBill(input: BillInput): Bill {
  const rate = input.rateOverridePence ?? input.unit.customKwhRatePence ?? input.period.kwhRatePence;
  const standingCharge =
    input.standingChargeOverridePence ??
    input.unit.customStandingChargePence ??
    input.period.standingChargePence;
  const usage = input.unit.freeSupplyMeter ? 0 : calculateUsage(input.reading.previousReading, input.reading.currentReading);
  const usageCostPence = Math.round(usage * rate);
  const subtotalPence = usageCostPence + (input.unit.freeSupplyMeter ? 0 : standingCharge) + input.period.levyPence;
  const outstandingCarriedForwardPence = input.outstandingOverridePence ?? input.unit.currentBalancePence;
  const totalDuePence = subtotalPence + outstandingCarriedForwardPence;
  const roundedTotalPence = Math.round(totalDuePence / 100) * 100;

  return {
    id: `bill-${input.period.id}-${input.unit.id}`,
    billingPeriodId: input.period.id,
    unitId: input.unit.id,
    previousReading: input.reading.previousReading,
    currentReading: input.reading.currentReading,
    usage,
    kwhRatePence: rate,
    standingChargePence: input.unit.freeSupplyMeter ? 0 : standingCharge,
    levyPence: input.period.levyPence,
    usageCostPence,
    subtotalPence,
    outstandingCarriedForwardPence,
    totalDuePence,
    roundedTotalPence,
    amountPaidPence: 0,
    remainingBalancePence: roundedTotalPence,
    paidStatus: "unpaid",
    adminNotes: input.adminNotes,
    tenantNotes: input.unit.freeSupplyMeter ? "Free supply meter" : undefined,
    pdfUrl: input.unit.tenantAccessToken ? `/bill/${input.unit.tenantAccessToken}` : undefined,
    issuedAt: input.period.issuedAt,
    smsSentAt: input.period.issuedAt,
    createdAt: input.period.createdAt
  };
}

export function applyPayment(bill: Bill, paymentPence: number): Bill {
  const amountPaidPence = bill.amountPaidPence + paymentPence;
  const remainingBalancePence = Math.max(0, bill.roundedTotalPence - amountPaidPence);
  return {
    ...bill,
    amountPaidPence,
    remainingBalancePence,
    paidStatus: remainingBalancePence === 0 ? "paid" : amountPaidPence > 0 ? "part_paid" : "unpaid",
    paymentDate: new Date().toISOString().slice(0, 10)
  };
}

export function periodTotals(bills: Bill[]) {
  return {
    units: bills.length,
    usageCostPence: bills.reduce((sum, bill) => sum + bill.usageCostPence, 0),
    standingChargePence: bills.reduce((sum, bill) => sum + bill.standingChargePence, 0),
    outstandingPence: bills.reduce((sum, bill) => sum + bill.outstandingCarriedForwardPence, 0),
    duePence: bills.reduce((sum, bill) => sum + bill.roundedTotalPence, 0),
    paidPence: bills.reduce((sum, bill) => sum + bill.amountPaidPence, 0),
    unpaidPence: bills.reduce((sum, bill) => sum + bill.remainingBalancePence, 0),
    usage: bills.reduce((sum, bill) => sum + bill.usage, 0)
  };
}

