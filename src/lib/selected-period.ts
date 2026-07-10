import type { BillingPeriod } from "./types";

export function getSelectedBillingPeriod(billingPeriods: BillingPeriod[], selectedPeriodId?: string) {
  return billingPeriods.find((period) => period.id === selectedPeriodId) ?? billingPeriods.find((period) => period.status === "draft") ?? billingPeriods[0];
}

export function withSelectedPeriod(href: string, periodId?: string) {
  if (!periodId) return href;
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("periodId", periodId);
  return `${path}?${params.toString()}`;
}