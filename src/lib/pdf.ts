import { formatAccountBalance, formatMoney, formatNumber } from "./money";
import { DEFAULT_PAYMENT_INSTRUCTIONS, renderPaymentInstructions } from "./payment-instructions";
import type { Bill, BillingPeriod, Estate, Unit } from "./types";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function paragraphs(value: string) {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("\n  ");
}

export function generateBillHtml(estate: Estate, unit: Unit, period: BillingPeriod, bill: Bill, paymentInstructions = DEFAULT_PAYMENT_INSTRUCTIONS): string {
  const renderedPaymentInstructions = renderPaymentInstructions(paymentInstructions, {
    estateName: estate.name,
    tenantName: unit.tenantName || "Tenant",
    unitNumber: unit.unitReference,
    amount: formatAccountBalance(bill.remainingBalancePence),
    paymentLink: ""
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Yardle bill ${escapeHtml(unit.unitReference)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #17212b; margin: 40px; }
    header { display: flex; justify-content: space-between; border-bottom: 2px solid #16846f; padding-bottom: 20px; }
    h1 { margin: 0; font-size: 28px; }
    table { width: 100%; border-collapse: collapse; margin-top: 28px; }
    td, th { padding: 12px; border-bottom: 1px solid #d8e0e6; text-align: left; }
    .total { font-size: 22px; font-weight: 700; color: #0f6f5f; }
    .instructions { margin-top: 28px; padding: 16px; border: 1px solid #d8e0e6; border-radius: 10px; }
    .instructions h2 { margin: 0 0 10px; font-size: 18px; }
    .instructions p { margin: 6px 0; line-height: 1.5; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Yardle</h1>
      <p>${escapeHtml(estate.name)}<br />${escapeHtml(estate.address)}</p>
    </div>
    <div>
      <strong>Electricity bill</strong><br />
      Issued ${bill.issuedAt ? new Date(bill.issuedAt).toLocaleDateString("en-GB") : "Draft"}
    </div>
  </header>
  <h2>${escapeHtml(unit.tenantName)} - Unit ${escapeHtml(unit.unitReference)}</h2>
  <p>Billing period: ${escapeHtml(period.name)}</p>
  <table>
    <tbody>
      <tr><th>Previous reading</th><td>${formatNumber(bill.previousReading)}</td></tr>
      <tr><th>Current reading</th><td>${formatNumber(bill.currentReading)}</td></tr>
      <tr><th>Units used</th><td>${formatNumber(bill.usage)} kWh</td></tr>
      <tr><th>Price per kWh</th><td>${formatMoney(bill.kwhRatePence)}</td></tr>
      <tr><th>Standing charge</th><td>${formatMoney(bill.standingChargePence)}</td></tr>
      <tr><th>Levy</th><td>${formatMoney(bill.levyPence)}</td></tr>
      <tr><th>Opening balance</th><td>${formatAccountBalance(bill.outstandingCarriedForwardPence)}</td></tr>
      <tr><th>Total due</th><td class="total">${formatMoney(bill.roundedTotalPence)}</td></tr>
    </tbody>
  </table>
  <section class="instructions">
    <h2>Payment instructions</h2>
    ${paragraphs(renderedPaymentInstructions)}
    <p>Contact ${escapeHtml(estate.contactEmail)} for support.</p>
  </section>
  <p>${escapeHtml(bill.adminNotes ?? "")}</p>
</body>
</html>`;
}


