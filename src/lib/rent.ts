import type { PaymentMethod, RentCharge, RentFrequency, RentPayment, RentSetting, Unit } from "./types";

export type RentLedgerRow = {
  unit: Unit;
  setting?: RentSetting;
  enabled: boolean;
  frequency: RentFrequency;
  weeklyOrMonthlyRentPence: number;
  chargedPence: number;
  paidPence: number;
  balancePence: number;
  nextDueDate: string;
  lastPaymentDate?: string;
  status: "up_to_date" | "due" | "arrears" | "credit" | "not_configured";
};

export const RENT_PAYMENT_METHODS: PaymentMethod[] = ["cash", "bank_transfer", "card", "other"];

export function poundsToPenceInput(value: string | number | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  return Math.round(Number(raw) * 100);
}

export function penceToPoundsInput(value: number | undefined) {
  return ((value ?? 0) / 100).toFixed(2);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function normaliseRentFrequency(value: string): RentFrequency {
  return value === "calendar_month" || value === "manual" ? value : "weekly_monday";
}

export function rentFrequencyLabel(value: RentFrequency) {
  if (value === "calendar_month") return "Calendar monthly";
  if (value === "manual") return "Manual";
  return "Weekly Monday";
}

export function rentStatusLabel(status: RentLedgerRow["status"]) {
  if (status === "up_to_date") return "Up to date";
  if (status === "arrears") return "Arrears";
  if (status === "credit") return "In credit";
  if (status === "not_configured") return "Not configured";
  return "Due";
}

export function rentStatusTone(status: RentLedgerRow["status"]) {
  if (status === "up_to_date") return "good" as const;
  if (status === "credit") return "info" as const;
  if (status === "not_configured") return "neutral" as const;
  return status === "arrears" ? "bad" as const : "warn" as const;
}

export function getRentDueDates(setting: RentSetting, throughDate = todayIso()) {
  if (!setting.enabled || setting.frequency === "manual" || setting.amountPence <= 0 || !setting.startDate) return [];
  const start = parseIsoDate(setting.startDate);
  const through = parseIsoDate(throughDate);
  if (!start || !through || start > through) return [];

  const dates: string[] = [];
  if (setting.frequency === "weekly_monday") {
    const current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 12));
    const day = current.getUTCDay();
    const daysUntilMonday = (8 - day) % 7;
    current.setUTCDate(current.getUTCDate() + daysUntilMonday);
    while (current <= through) {
      dates.push(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 7);
    }
    return dates;
  }

  const dueDay = Math.min(28, Math.max(1, setting.dueDayOfMonth ?? 1));
  const current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), dueDay, 12));
  if (current < start) current.setUTCMonth(current.getUTCMonth() + 1);
  while (current <= through) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCMonth(current.getUTCMonth() + 1);
  }
  return dates;
}

export function nextRentDueDate(setting?: RentSetting) {
  if (!setting || !setting.enabled || setting.frequency === "manual") return "-";
  const today = parseIsoDate(todayIso());
  if (!today) return "-";
  if (setting.frequency === "weekly_monday") {
    const next = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12));
    const daysUntilMonday = (8 - next.getUTCDay()) % 7 || 7;
    next.setUTCDate(next.getUTCDate() + daysUntilMonday);
    return next.toISOString().slice(0, 10);
  }
  const dueDay = Math.min(28, Math.max(1, setting.dueDayOfMonth ?? 1));
  const next = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), dueDay, 12));
  if (next <= today) next.setUTCMonth(next.getUTCMonth() + 1);
  return next.toISOString().slice(0, 10);
}

export function buildRentLedger(units: Unit[], settings: RentSetting[], charges: RentCharge[], payments: RentPayment[]): RentLedgerRow[] {
  return units
    .filter((unit) => unit.status !== "inactive" && unit.status !== "not_used")
    .map((unit) => {
      const setting = settings.find((item) => item.unitId === unit.id);
      const unitCharges = charges.filter((item) => item.unitId === unit.id && item.status !== "cancelled");
      const unitPayments = payments.filter((item) => item.unitId === unit.id && !item.reversedAt);
      const chargedPence = unitCharges.reduce((sum, charge) => sum + charge.amountPence, 0);
      const paidPence = unitPayments.reduce((sum, payment) => sum + payment.amountPence, 0);
      const balancePence = chargedPence - paidPence;
      const lastPaymentDate = unitPayments.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))[0]?.paymentDate;
      const enabled = Boolean(setting?.enabled);
      const status: RentLedgerRow["status"] = !enabled ? "not_configured" : balancePence < 0 ? "credit" : balancePence === 0 ? "up_to_date" : balancePence > (setting?.amountPence ?? 0) ? "arrears" : "due";
      return {
        unit,
        setting,
        enabled,
        frequency: setting?.frequency ?? "weekly_monday",
        weeklyOrMonthlyRentPence: setting?.amountPence ?? 0,
        chargedPence,
        paidPence,
        balancePence,
        nextDueDate: nextRentDueDate(setting),
        lastPaymentDate,
        status
      };
    })
    .sort((a, b) => a.unit.unitReference.localeCompare(b.unit.unitReference, undefined, { numeric: true }));
}

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}