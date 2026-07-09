export function poundsToPence(value: number): number {
  return Math.round(value * 100);
}

export function formatMoney(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP"
  }).format(pence / 100);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 2
  }).format(value);
}
