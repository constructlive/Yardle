import { calculateBill, calculateUsage } from "./billing";
import { poundsToPence } from "./money";
import type { Bill, BillingPeriod, Estate, MeterReading, Payment, SmsLog, Unit, User } from "./types";

const now = "2026-06-01T09:00:00.000Z";
const estateId = "estate-yardle";
const periodId = "period-may-2026";

export const users: User[] = [
  { id: "user-super", name: "Avery Stone", email: "super@yardle.test", mobile: "07123 000001", role: "super_admin", createdAt: now },
  { id: "user-admin", name: "Morgan Lane", email: "admin@yardle.test", mobile: "07123 000002", role: "admin", createdAt: now },
  { id: "user-tenant", name: "Priya Motors", email: "tenant@priyamotors.test", mobile: "07123 000003", role: "tenant", createdAt: now }
];

export const estate: Estate = {
  id: estateId,
  name: "Yardle Industrial Estate",
  address: "Unit Road, Walsall, WS1 1AA",
  contactEmail: "billing@yardle.test",
  contactPhone: "01922 000 100",
  defaultKwhRatePence: poundsToPence(0.32),
  defaultStandingChargePence: poundsToPence(5),
  defaultLevyPence: poundsToPence(0),
  currency: "GBP",
  smsSenderName: "Yardle",
  createdAt: now
};

const refs = ["1", "2/3", "4", "5", "6", "7", "8", "9", "10", "11", "11A", "12", "12A", "14", "15", "16", "17", "18", "19", "20/21", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "BOB", "C/WASH", "FLAT 1", "FLAT 2"];
const tenants = ["Priya Motors", "Northgate Fabrication", "Greenline Joinery", "West Yard Storage", "Blacksmith Coatings", "Metro Tyres", "Castle Signs", "Juno Foods", "Arc Welding", "Horizon Print"];

export const units: Unit[] = refs.map((unitReference, index) => {
  const inactive = index === 12 || index === 37;
  const empty = index === 6 || index === 22;
  const freeSupply = unitReference === "C/WASH";
  const tenantName = empty ? "Empty" : tenants[index % tenants.length];
  return {
    id: `unit-${unitReference.toLowerCase().replaceAll("/", "-").replaceAll(" ", "-")}`,
    estateId,
    unitReference,
    tenantName,
    tenantContactName: empty ? "" : `${tenantName.split(" ")[0]} contact`,
    tenantEmail: empty ? "" : `billing+${index + 1}@example.test`,
    tenantMobile: empty ? "" : `07${String(500000000 + index * 13791).slice(0, 9)}`,
    status: inactive ? "inactive" : empty ? "empty" : "active",
    notes: freeSupply ? "Communal wash bay meter" : undefined,
    freeSupplyMeter: freeSupply,
    customKwhRatePence: index === 4 ? poundsToPence(0.29) : undefined,
    customStandingChargePence: unitReference === "FLAT 1" || unitReference === "FLAT 2" ? poundsToPence(3.5) : undefined,
    openingBalancePence: index % 5 === 0 ? poundsToPence(18 + index) : 0,
    currentBalancePence: index % 5 === 0 ? poundsToPence(18 + index) : 0,
    tenantAccessToken: `demo_${index.toString().padStart(2, "0")}_W8Kf4vQp2N7xR9mT6cL3sH5jD1zB0yUeA`,
    tenantAccessTokenCreatedAt: now,
    tenantAccessEnabled: !empty,
    createdAt: now
  };
});

export const billingPeriods: BillingPeriod[] = [
  {
    id: periodId,
    estateId,
    name: "1st May - 31st May 2026",
    startDate: "2026-05-01",
    endDate: "2026-05-31",
    status: "issued",
    kwhRatePence: estate.defaultKwhRatePence,
    standingChargePence: estate.defaultStandingChargePence,
    levyPence: estate.defaultLevyPence,
    createdBy: "user-admin",
    issuedAt: "2026-06-01T10:15:00.000Z",
    createdAt: now
  },
  {
    id: "period-june-2026",
    estateId,
    name: "1st June - 30th June 2026",
    startDate: "2026-06-01",
    endDate: "2026-06-30",
    status: "draft",
    kwhRatePence: estate.defaultKwhRatePence,
    standingChargePence: estate.defaultStandingChargePence,
    levyPence: estate.defaultLevyPence,
    createdBy: "user-admin",
    createdAt: "2026-06-30T08:30:00.000Z"
  }
];

export const meterReadings: MeterReading[] = units.map((unit, index) => {
  const previousReading = 4200 + index * 93;
  const currentReading = previousReading + (unit.status === "active" ? 38 + (index % 8) * 11 : 0);
  const usage = calculateUsage(previousReading, currentReading);
  return {
    id: `reading-${unit.id}`,
    billingPeriodId: periodId,
    unitId: unit.id,
    previousReading,
    currentReading,
    usage,
    isEstimated: index % 11 === 0,
    readingNotes: index % 11 === 0 ? "Estimated from typical monthly use" : undefined,
    readingStatus: "billed",
    enteredBy: "user-admin",
    enteredAt: "2026-05-31T16:00:00.000Z"
  };
});

export const bills: Bill[] = units
  .filter((unit) => unit.status === "active" || unit.status === "empty")
  .map((unit, index) => {
    const reading = meterReadings.find((item) => item.unitId === unit.id)!;
    const bill = calculateBill({ unit, period: billingPeriods[0], reading });
    const paid = index % 3 === 0 ? bill.roundedTotalPence : index % 3 === 1 ? Math.floor(bill.roundedTotalPence / 2) : 0;
    return {
      ...bill,
      amountPaidPence: paid,
      remainingBalancePence: Math.max(0, bill.roundedTotalPence - paid),
      paidStatus: paid === 0 ? "unpaid" : paid >= bill.roundedTotalPence ? "paid" : "part_paid",
      paymentDate: paid > 0 ? "2026-06-04" : undefined
    };
  });

export const payments: Payment[] = bills
  .filter((bill) => bill.amountPaidPence > 0)
  .map((bill, index) => ({
    id: `payment-${bill.id}`,
    billId: bill.id,
    unitId: bill.unitId,
    amountPence: bill.amountPaidPence,
    paymentMethod: index % 2 === 0 ? "bank_transfer" : "cash",
    paymentDate: bill.paymentDate ?? "2026-06-04",
    notes: index % 2 === 0 ? "Matched from bank statement" : "Recorded at office",
    recordedBy: "user-admin",
    createdAt: "2026-06-04T12:00:00.000Z"
  }));

export const smsLogs: SmsLog[] = bills.slice(0, 18).map((bill, index) => {
  const unit = units.find((item) => item.id === bill.unitId)!;
  return {
    id: `sms-${bill.id}`,
    billId: bill.id,
    unitId: bill.unitId,
    mobile: unit.tenantMobile || "No mobile",
    message: `Your Yardle electricity bill for 1st May - 31st May 2026 is ready. Total due: GBP ${(bill.roundedTotalPence / 100).toFixed(2)}. View it here: /bill/${unit.tenantAccessToken}`,
    status: "simulated",
    provider: "mock",
    providerReference: `mock-${index + 1}`,
    sentAt: "2026-06-01T10:16:00.000Z",
    createdAt: "2026-06-01T10:16:00.000Z"
  };
});

export function getTenantUnit() {
  return units.find((unit) => unit.tenantName === "Priya Motors") ?? units[0];
}




