export function poundsToPence(value: number): number {
  return Math.round(value * 100);
}

export function formatMoney(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP"
  }).format(pence / 100);
}


export function formatRoundedMoney(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0
  }).format(Math.round(pence / 100));
}

export function formatRoundedAccountBalance(pence: number): string {
  return pence < 0 ? `${formatRoundedMoney(Math.abs(pence))} credit` : formatRoundedMoney(pence);
}
export function formatAccountBalance(pence: number): string {
  return pence < 0 ? `${formatMoney(Math.abs(pence))} credit` : formatMoney(pence);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 2
  }).format(value);
}

