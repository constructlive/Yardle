import { getAppData } from "./data";
import { formatMoney } from "./money";

export async function buildOutstandingReport() {
  const { bills, units } = await getAppData();
  return bills.filter((bill) => bill.remainingBalancePence > 0).map((bill) => {
    const unit = units.find((item) => item.id === bill.unitId)!;
    return { unit: unit.unitReference, tenant: unit.tenantName, outstanding: bill.remainingBalancePence, status: bill.paidStatus };
  });
}

export async function buildCsvExport(): Promise<string> {
  const { bills, billingPeriods, units } = await getAppData();
  const rows = [["period", "unit", "tenant name", "reading 1", "reading 2", "used", "subtotal", "outstanding", "total", "paid", "notes"], ...bills.map((bill) => {
    const unit = units.find((item) => item.id === bill.unitId)!;
    const period = billingPeriods.find((item) => item.id === bill.billingPeriodId)!;
    return [period.name, unit.unitReference, unit.tenantName, bill.previousReading, bill.currentReading, bill.usage, formatMoney(bill.subtotalPence), formatMoney(bill.outstandingCarriedForwardPence), formatMoney(bill.roundedTotalPence), formatMoney(bill.amountPaidPence), bill.adminNotes ?? ""];
  })];
  return rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
}

export async function tenantPaymentHistory(unitId: string) {
  const { payments } = await getAppData();
  return payments.filter((payment) => payment.unitId === unitId);
}
