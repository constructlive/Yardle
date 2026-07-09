import { DataTable, PageHeader, PrimaryButton, StatCard, Td, Th } from "@/components/ui";
import { getAppData } from "@/lib/data";
import { formatMoney, formatNumber } from "@/lib/money";
import { Download, FileSpreadsheet, Gauge, TrendingUp } from "lucide-react";

function buildCsvExport(bills: any[], billingPeriods: any[], units: any[]) {
  const rows = [["period", "unit", "tenant name", "reading 1", "reading 2", "used", "subtotal", "outstanding", "total", "paid", "notes"], ...bills.map((bill) => { const unit = units.find((item) => item.id === bill.unitId); const period = billingPeriods.find((item) => item.id === bill.billingPeriodId); return [period?.name ?? "", unit?.unitReference ?? "", unit?.tenantName ?? "", bill.previousReading, bill.currentReading, bill.usage, formatMoney(bill.subtotalPence), formatMoney(bill.outstandingCarriedForwardPence), formatMoney(bill.roundedTotalPence), formatMoney(bill.amountPaidPence), bill.adminNotes ?? ""]; })];
  return rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
}

export default async function ReportsPage() {
  const { bills, billingPeriods, units } = await getAppData();
  const outstanding = bills.filter((bill) => bill.remainingBalancePence > 0).map((bill) => ({ bill, unit: units.find((unit) => unit.id === bill.unitId) }));
  const totalUsage = bills.reduce((sum, bill) => sum + bill.usage, 0);
  const csv = buildCsvExport(bills, billingPeriods, units);
  return <><PageHeader title="Reports" eyebrow="Billing and tenant history" action={<PrimaryButton><Download className="h-5 w-5" />Export CSV</PrimaryButton>} /><section className="mb-6 grid gap-4 sm:grid-cols-3"><StatCard label="Outstanding report" value={outstanding.length} hint="Units with money due" icon={TrendingUp} tone="warning" /><StatCard label="Usage by unit" value={`${formatNumber(totalUsage)} kWh`} hint="Last issued period" icon={Gauge} tone="blue" /><StatCard label="CSV rows ready" value={csv.split("\n").length - 1} hint="Import/export format" icon={FileSpreadsheet} tone="green" /></section><DataTable><thead><tr><Th>Unit</Th><Th>Tenant</Th><Th>Outstanding</Th><Th>Status</Th></tr></thead><tbody>{outstanding.map(({ bill, unit }) => <tr key={bill.id}><Td strong>{unit?.unitReference ?? "-"}</Td><Td>{unit?.tenantName ?? "-"}</Td><Td>{formatMoney(bill.remainingBalancePence)}</Td><Td>{bill.paidStatus.replace("_", " ")}</Td></tr>)}</tbody></DataTable><section className="mt-6 rounded-2xl border border-slateLine bg-card p-5 shadow-soft"><h2 className="text-xl font-black text-ink">CSV preview</h2><pre className="mt-4 max-h-64 overflow-auto rounded-2xl border border-slateLine bg-[#0f1113] p-4 text-xs text-secondaryText">{csv}</pre></section></>;
}
