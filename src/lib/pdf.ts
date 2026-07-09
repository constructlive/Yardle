import { formatMoney, formatNumber } from "./money";
import type { Bill, BillingPeriod, Estate, Unit } from "./types";

export function generateBillHtml(estate: Estate, unit: Unit, period: BillingPeriod, bill: Bill): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Yardle bill ${unit.unitReference}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #17212b; margin: 40px; }
    header { display: flex; justify-content: space-between; border-bottom: 2px solid #16846f; padding-bottom: 20px; }
    h1 { margin: 0; font-size: 28px; }
    table { width: 100%; border-collapse: collapse; margin-top: 28px; }
    td, th { padding: 12px; border-bottom: 1px solid #d8e0e6; text-align: left; }
    .total { font-size: 22px; font-weight: 700; color: #0f6f5f; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Yardle</h1>
      <p>${estate.name}<br />${estate.address}</p>
    </div>
    <div>
      <strong>Electricity bill</strong><br />
      Issued ${bill.issuedAt ? new Date(bill.issuedAt).toLocaleDateString("en-GB") : "Draft"}
    </div>
  </header>
  <h2>${unit.tenantName} - Unit ${unit.unitReference}</h2>
  <p>Billing period: ${period.name}</p>
  <table>
    <tbody>
      <tr><th>Previous reading</th><td>${formatNumber(bill.previousReading)}</td></tr>
      <tr><th>Current reading</th><td>${formatNumber(bill.currentReading)}</td></tr>
      <tr><th>Units used</th><td>${formatNumber(bill.usage)} kWh</td></tr>
      <tr><th>Price per kWh</th><td>${formatMoney(bill.kwhRatePence)}</td></tr>
      <tr><th>Standing charge</th><td>${formatMoney(bill.standingChargePence)}</td></tr>
      <tr><th>Levy</th><td>${formatMoney(bill.levyPence)}</td></tr>
      <tr><th>Outstanding balance</th><td>${formatMoney(bill.outstandingCarriedForwardPence)}</td></tr>
      <tr><th>Total due</th><td class="total">${formatMoney(bill.roundedTotalPence)}</td></tr>
    </tbody>
  </table>
  <p>Please pay by bank transfer using your unit reference. Contact ${estate.contactEmail} for support.</p>
  <p>${bill.adminNotes ?? ""}</p>
</body>
</html>`;
}


