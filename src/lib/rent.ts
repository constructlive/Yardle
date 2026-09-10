import type { PaymentMethod, RentCharge, RentFrequency, RentPayment, RentSetting, Unit } from "./types";

export type RentLedgerRow = {
  unit: Unit;
  setting?: RentSetting;
  enabled: boolean;
  frequency: RentFrequency;
  weeklyOrMonthlyRentPence: number;
  openingBalancePence: number;
  chargedPence: number;
  paidPence: number;
  balancePence: number;
  nextDueDate: string;
  lastPaymentDate?: string;
  status: "up_to_date" | "due" | "arrears" | "credit" | "not_configured";
  combinedAccount?: string;
};

export type RentAccountLedgerRow = RentLedgerRow & {
  units: Unit[];
  memberUnitIds: string[];
  unitReferences: string;
  tenantName: string;
  isCombined: boolean;
};

const RENT_META_PREFIX = "yardle_rent_meta:";

export const RENT_PAYMENT_METHODS: PaymentMethod[] = ["cash", "bank_transfer", "card", "other"];

export function parseRentNotes(value: string | null | undefined) {
  const lines = String(value ?? "").split(/\r?\n/);
  const visible: string[] = [];
  let combinedAccount = "";

  for (const line of lines) {
    if (line.startsWith(RENT_META_PREFIX)) {
      try {
        const meta = JSON.parse(line.slice(RENT_META_PREFIX.length));
        combinedAccount = typeof meta.combinedAccount === "string" ? meta.combinedAccount : "";
      } catch {
        visible.push(line);
      }
    } else {
      visible.push(line);
    }
  }

  return { notes: visible.join("\n").trim(), combinedAccount: combinedAccount.trim() };
}

export function serializeRentNotes(notes: string | null | undefined, combinedAccount: string | null | undefined) {
  const cleanNotes = String(notes ?? "").trim();
  const cleanCombinedAccount = String(combinedAccount ?? "").trim();
  const parts = cleanNotes ? [cleanNotes] : [];
  if (cleanCombinedAccount) parts.push(`${RENT_META_PREFIX}${JSON.stringify({ combinedAccount: cleanCombinedAccount })}`);
  return parts.join("\n") || undefined;
}

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
      const openingBalancePence = setting?.openingBalancePence ?? 0;
      const chargedPence = unitCharges.reduce((sum, charge) => sum + charge.amountPence, 0);
      const paidPence = unitPayments.reduce((sum, payment) => sum + payment.amountPence, 0);
      const balancePence = openingBalancePence + chargedPence - paidPence;
      const lastPaymentDate = unitPayments.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))[0]?.paymentDate;
      const enabled = Boolean(setting?.enabled);
      const status: RentLedgerRow["status"] = !enabled ? "not_configured" : balancePence < 0 ? "credit" : balancePence === 0 ? "up_to_date" : balancePence > (setting?.amountPence ?? 0) ? "arrears" : "due";
      return {
        unit,
        setting,
        enabled,
        frequency: setting?.frequency ?? "weekly_monday",
        weeklyOrMonthlyRentPence: setting?.amountPence ?? 0,
        openingBalancePence,
        chargedPence,
        paidPence,
        balancePence,
        nextDueDate: nextRentDueDate(setting),
        lastPaymentDate,
        status,
        combinedAccount: parseRentNotes(setting?.notes).combinedAccount
      };
    })
    .sort((a, b) => a.unit.unitReference.localeCompare(b.unit.unitReference, undefined, { numeric: true }));
}

export function buildRentAccountLedger(units: Unit[], settings: RentSetting[], charges: RentCharge[], payments: RentPayment[]): RentAccountLedgerRow[] {
  const rows = buildRentLedger(units, settings, charges, payments).filter((row) => row.enabled || row.balancePence !== 0);
  const grouped = new Map<string, RentLedgerRow[]>();

  for (const row of rows) {
    const key = row.combinedAccount ? `account:${row.combinedAccount.toLowerCase()}` : `unit:${row.unit.id}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  return Array.from(grouped.values())
    .map((members) => {
      const primary = members[0];
      const openingBalancePence = members.reduce((sum, row) => sum + row.openingBalancePence, 0);
      const chargedPence = members.reduce((sum, row) => sum + row.chargedPence, 0);
      const paidPence = members.reduce((sum, row) => sum + row.paidPence, 0);
      const balancePence = openingBalancePence + chargedPence - paidPence;
      const rentAmount = members.reduce((sum, row) => sum + row.weeklyOrMonthlyRentPence, 0);
      const status: RentLedgerRow["status"] = !members.some((row) => row.enabled) ? "not_configured" : balancePence < 0 ? "credit" : balancePence === 0 ? "up_to_date" : balancePence > rentAmount ? "arrears" : "due";
      const nextDueDates = members.map((row) => row.nextDueDate).filter((date) => date !== "-").sort();
      const paymentDates = members.map((row) => row.lastPaymentDate).filter((date): date is string => Boolean(date)).sort().reverse();
      const tenantName = primary.combinedAccount || primary.unit.tenantName || "Vacant";
      return {
        ...primary,
        units: members.map((row) => row.unit),
        memberUnitIds: members.map((row) => row.unit.id),
        unitReferences: members.map((row) => row.unit.unitReference).join(", "),
        tenantName,
        isCombined: members.length > 1,
        weeklyOrMonthlyRentPence: rentAmount,
        openingBalancePence,
        chargedPence,
        paidPence,
        balancePence,
        nextDueDate: nextDueDates[0] ?? "-",
        lastPaymentDate: paymentDates[0],
        status
      };
    })
    .sort((a, b) => a.unitReferences.localeCompare(b.unitReferences, undefined, { numeric: true }));
}

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
