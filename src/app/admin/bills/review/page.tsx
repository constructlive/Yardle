import { DataTable, PageHeader, PrimaryButton, SecondaryButton, StatCard, StatusPill, Td, Th } from "@/components/ui";
import { issueBills } from "@/lib/actions";
import { calculateBill, periodTotals } from "@/lib/billing";
import { getAppData } from "@/lib/data";
import { getSelectedBillingPeriod, withSelectedPeriod } from "@/lib/selected-period";
import { formatMoney, formatNumber } from "@/lib/money";
import { CheckCircle2, Coins, Gauge, ReceiptText, TrendingUp, Users } from "lucide-react";

export const dynamic = "force-dynamic";

function EmptyState({ title, message, href, action }: { title: string; message: string; href?: string; action?: string }) {
  return <section className="rounded-2xl border border-slateLine bg-card p-8 text-center shadow-soft"><h2 className="text-2xl font-black text-ink">{title}</h2><p className="mx-auto mt-3 max-w-2xl font-bold text-mutedText">{message}</p>{href && action ? <div className="mt-5"><SecondaryButton href={href}>{action}</SecondaryButton></div> : null}</section>;
}

function EmptyRow({ children }: { children: string }) {
  return <tr><td colSpan={12} className="px-4 py-8 text-center font-bold text-mutedText">{children}</td></tr>;
}

export default async function BillReviewPage({ searchParams }: { searchParams: { periodId?: string; error?: string } }) {
  const { billingPeriods, meterReadings, units, setupError } = await getAppData();
  const period = getSelectedBillingPeriod(billingPeriods, searchParams.periodId);
  const issueError = searchParams.error ? decodeURIComponent(searchParams.error) : "";

  if (!period) {
    return <><PageHeader title="Bill review" eyebrow="Check before issuing" action={null} />{setupError ? <section className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-100 shadow-soft"><h2 className="text-xl font-black">Setup required</h2><p className="mt-2 text-sm font-bold text-red-200/80">{setupError}</p></section> : null}<EmptyState title="No draft billing period" message="Create a billing period before reviewing or issuing bills." href="/admin/periods" action="Open billing periods" /></>;
  }

  if (units.length === 0) {
    return <><PageHeader title="Bill review" eyebrow={period.name} action={<StatusPill tone="neutral">No units</StatusPill>} /><EmptyState title="No units available" message="Add units before readings can be reviewed for billing." href="/admin/units" action="Open units" /></>;
  }

  const requiredUnits = units.filter((unit) => unit.status === "active" && !unit.freeSupplyMeter);
  const periodReadings = meterReadings.filter((reading) => reading.billingPeriodId === period.id);
  const completeIds = new Set(periodReadings.map((reading) => reading.unitId));
  const missing = requiredUnits.filter((unit) => !completeIds.has(unit.id)).length;
  const reviewBills = units.filter((unit) => unit.status === "active" || unit.status === "empty").map((unit) => {
    const reading = periodReadings.find((item) => item.unitId === unit.id);
    return reading ? calculateBill({ unit, period, reading }) : undefined;
  }).filter(Boolean) as ReturnType<typeof calculateBill>[];
  const totals = periodTotals(reviewBills);
  const canIssue = missing === 0 && period.status === "draft" && reviewBills.length > 0;
  const action = canIssue ? <form action={issueBills}><input type="hidden" name="periodId" value={period.id} /><PrimaryButton><CheckCircle2 className="h-5 w-5" />Issue bills</PrimaryButton></form> : <StatusPill tone={missing ? "warn" : "neutral"}>{missing ? `${missing} readings missing` : "No bills ready"}</StatusPill>;

  return <>
    <PageHeader title="Bill review" eyebrow={period.name} action={action} />
    {setupError ? <section className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-100 shadow-soft"><h2 className="text-xl font-black">Setup required</h2><p className="mt-2 text-sm font-bold text-red-200/80">{setupError}</p></section> : null}
    {issueError ? <section className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-100 shadow-soft"><h2 className="text-xl font-black">Bills were not issued</h2><p className="mt-2 text-sm font-bold text-red-200/80">{issueError}</p></section> : null}
    {periodReadings.length === 0 ? <section className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-100 shadow-soft"><h2 className="text-xl font-black">No readings complete</h2><p className="mt-2 text-sm font-bold text-amber-200/80">Enter readings for this period before reviewing bills.</p><div className="mt-4"><SecondaryButton href={withSelectedPeriod("/admin/readings", period?.id)}>Enter readings</SecondaryButton></div></section> : null}
    <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><StatCard label="Units" value={totals.units} icon={Users} tone="green" /><StatCard label="Usage cost" value={formatMoney(totals.usageCostPence)} icon={Gauge} tone="blue" /><StatCard label="Standing" value={formatMoney(totals.standingChargePence)} icon={ReceiptText} tone="purple" /><StatCard label="Outstanding" value={formatMoney(totals.outstandingPence)} icon={TrendingUp} tone="warning" /><StatCard label="Total due" value={formatMoney(totals.duePence)} icon={Coins} tone="green" /><StatCard label="Unpaid" value={formatMoney(totals.unpaidPence)} icon={ReceiptText} tone="danger" /></section>
    <DataTable><thead><tr><Th>Unit</Th><Th>Tenant</Th><Th>Reading entered</Th><Th>Previous</Th><Th>Current</Th><Th>Usage</Th><Th>Rate</Th><Th>Standing</Th><Th>Levy</Th><Th>Subtotal</Th><Th>Outstanding</Th><Th>Total due</Th></tr></thead><tbody>{reviewBills.length ? reviewBills.map((bill) => { const unit = units.find((item) => item.id === bill.unitId); const reading = periodReadings.find((item) => item.unitId === bill.unitId); return <tr key={bill.id}><Td strong>{unit?.unitReference ?? "-"}</Td><Td>{unit?.tenantName || "No tenant assigned"}</Td><Td>{reading?.enteredAt ? new Date(reading.enteredAt).toLocaleString("en-GB") : "-"}</Td><Td>{formatNumber(bill.previousReading)}</Td><Td>{formatNumber(bill.currentReading)}</Td><Td>{formatNumber(bill.usage)}</Td><Td>{formatMoney(bill.kwhRatePence)}</Td><Td>{formatMoney(bill.standingChargePence)}</Td><Td>{formatMoney(bill.levyPence)}</Td><Td>{formatMoney(bill.subtotalPence)}</Td><Td>{formatMoney(bill.outstandingCarriedForwardPence)}</Td><Td strong>{formatMoney(bill.roundedTotalPence)}</Td></tr>; }) : <EmptyRow>No bills ready to review.</EmptyRow>}</tbody></DataTable>
  </>;
}