import type { BillingPeriod } from "./types";

function ordinal(day: number) {
  if (day > 10 && day < 14) return `${day}th`;
  if (day % 10 === 1) return `${day}st`;
  if (day % 10 === 2) return `${day}nd`;
  if (day % 10 === 3) return `${day}rd`;
  return `${day}th`;
}

export function nextPeriodDetails(period: BillingPeriod) {
  const start = new Date(`${period.endDate}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 12));
  const month = start.toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
  const endMonth = end.toLocaleString("en-GB", { month: "long", timeZone: "UTC" });

  return {
    estateId: period.estateId,
    name: `${ordinal(start.getUTCDate())} ${month} - ${ordinal(end.getUTCDate())} ${endMonth} ${end.getUTCFullYear()}`,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    status: "draft" as const,
    kwhRatePence: period.kwhRatePence,
    standingChargePence: period.standingChargePence,
    levyPence: period.levyPence,
    createdBy: period.createdBy
  };
}
