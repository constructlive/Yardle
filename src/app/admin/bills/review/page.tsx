import { DataTable, PageHeader, PrimaryButton, StatCard, StatusPill, Td, Th } from "@/components/ui";
import { issueBills } from "@/lib/actions";
import { calculateBill, periodTotals } from "@/lib/billing";
import { getAppData } from "@/lib/data";
import { formatMoney, formatNumber } from "@/lib/money";
import { CheckCircle2, Coins, Gauge, ReceiptText, TrendingUp, Users } from "lucide-react";

export default async function BillReviewPage() {
  const { billingPeriods, meterReadings, units } = await getAppData();
  const period = billingPeriods.find((item) => item.status === "draft") ?? billingPeriods[0];
  const requiredUnits = units.filter((unit) => unit.status === "active" && !unit.freeSupplyMeter);
  const periodReadings = meterReadings.filter((reading) => reading.billingPeriodId === period.id);
  const completeIds = new Set(periodReadings.map((reading) => reading.unitId));
  const missing = requiredUnits.filter((unit) => !completeIds.has(unit.id)).length;
  const reviewBills = units.filter((unit) => unit.status === "active" || unit.status === "empty").map((unit) => {
    const reading = periodReadings.find((item) => item.unitId === unit.id);
    return reading ? calculateBill({ unit, period, reading }) : undefined;
  }).filter(Boolean) as ReturnType<typeof calculateBill>[];
  const totals = periodTotals(reviewBills);
  const action = missing === 0 && period.status === "draft" ? <form action={issueBills}><input type="hidden" name="periodId" value={period.id} /><PrimaryButton><CheckCircle2 className="h-5 w-5" />Issue bills</PrimaryButton></form> : <StatusPill tone="warn">{missing} readings missing</StatusPill>;
  return <>
    <PageHeader title="Bill review" eyebrow="Check before issuing" action={action} />
    <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><StatCard label="Units" value={totals.units} icon={Users} tone="green" /><StatCard label="Usage cost" value={formatMoney(totals.usageCostPence)} icon={Gauge} tone="blue" /><StatCard label="Standing" value={formatMoney(totals.standingChargePence)} icon={ReceiptText} tone="purple" /><StatCard label="Outstanding" value={formatMoney(totals.outstandingPence)} icon={TrendingUp} tone="warning" /><StatCard label="Total due" value={formatMoney(totals.duePence)} icon={Coins} tone="green" /><StatCard label="Unpaid" value={formatMoney(totals.unpaidPence)} icon={ReceiptText} tone="danger" /></section>
    <DataTable><thead><tr><Th>Unit</Th><Th>Tenant</Th><Th>Reading entered</Th><Th>Previous</Th><Th>Current</Th><Th>Usage</Th><Th>Rate</Th><Th>Standing</Th><Th>Levy</Th><Th>Subtotal</Th><Th>Outstanding</Th><Th>Total due</Th></tr></thead><tbody>{reviewBills.map((bill) => { const unit = units.find((item) => item.id === bill.unitId)!; const reading = periodReadings.find((item) => item.unitId === bill.unitId)!; return <tr key={bill.id}><Td strong>{unit.unitReference}</Td><Td>{unit.tenantName}</Td><Td>{new Date(reading.enteredAt).toLocaleString("en-GB")}</Td><Td>{formatNumber(bill.previousReading)}</Td><Td>{formatNumber(bill.currentReading)}</Td><Td>{formatNumber(bill.usage)}</Td><Td>{formatMoney(bill.kwhRatePence)}</Td><Td>{formatMoney(bill.standingChargePence)}</Td><Td>{formatMoney(bill.levyPence)}</Td><Td>{formatMoney(bill.subtotalPence)}</Td><Td>{formatMoney(bill.outstandingCarriedForwardPence)}</Td><Td strong>{formatMoney(bill.roundedTotalPence)}</Td></tr>; })}</tbody></DataTable>
  </>;
}