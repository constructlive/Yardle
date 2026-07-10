import { DataTable, PageHeader, PrimaryButton, SecondaryButton, StatCard, StatusPill, Td, Th } from "@/components/ui";
import { issueBills } from "@/lib/actions";
import { getAppData } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { getSelectedBillingPeriod, withSelectedPeriod } from "@/lib/selected-period";
import { BarChart3, CheckCircle2, ClipboardCheck, CreditCard, Gauge, MessageSquare, ReceiptText, TrendingUp, Users } from "lucide-react";

export const dynamic = "force-dynamic";

function EmptyRow({ children, colSpan }: { children: string; colSpan: number }) {
  return <tr><td colSpan={colSpan} className="px-4 py-8 text-center font-bold text-mutedText">{children}</td></tr>;
}

export default async function AdminDashboard({ searchParams }: { searchParams: { periodId?: string } }) {
  const { bills, billingPeriods, meterReadings, payments, smsLogs, units, setupError } = await getAppData();
  const period = getSelectedBillingPeriod(billingPeriods, searchParams.periodId);
  const requiredUnits = units.filter((unit) => unit.status === "active" && !unit.freeSupplyMeter);
  const periodReadings = period ? meterReadings.filter((reading) => reading.billingPeriodId === period.id) : [];
  const readIds = new Set(periodReadings.map((reading) => reading.unitId));
  const readingsComplete = requiredUnits.filter((unit) => readIds.has(unit.id)).length;
  const readingsMissing = period ? Math.max(0, requiredUnits.length - readingsComplete) : requiredUnits.length;
  const readyToIssue = Boolean(period && period.status === "draft" && requiredUnits.length > 0 && readingsMissing === 0);
  const periodBills = period ? bills.filter((bill) => bill.billingPeriodId === period.id) : [];
  const totalOutstanding = bills.reduce((sum, bill) => sum + bill.remainingBalancePence, 0);
  const latestIssued = billingPeriods.filter((item) => item.issuedAt).sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)))[0];
  const billingStatus = !period ? "No active period" : readyToIssue ? "Ready to Issue" : period.status === "draft" ? "Draft" : "Issued";
  const billingHint = !period ? "Create a billing period to begin" : readingsMissing ? `${readingsMissing} readings missing` : latestIssued?.issuedAt ? `Last issued ${new Date(latestIssued.issuedAt).toLocaleString("en-GB")}` : requiredUnits.length ? "All readings complete" : "No active meters";

  return <>
    <PageHeader title="Dashboard" eyebrow="Yardle Industrial Estate" action={<PrimaryButton href={withSelectedPeriod("/admin/readings", period?.id)}><Gauge className="h-5 w-5" />Enter readings</PrimaryButton>} />
    {setupError ? <section className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-100 shadow-soft"><h2 className="text-xl font-black">Setup required</h2><p className="mt-2 text-sm font-bold text-red-200/80">{setupError}</p></section> : null}
    {!period ? <section className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-100 shadow-soft"><h2 className="text-xl font-black">No current billing period</h2><p className="mt-2 text-sm font-bold text-amber-200/80">Create a billing period before entering meter readings or issuing bills.</p><div className="mt-4"><SecondaryButton href="/admin/periods">Open billing periods</SecondaryButton></div></section> : null}
    {units.length === 0 ? <section className="mb-6 rounded-2xl border border-slateLine bg-card p-5 shadow-soft"><h2 className="text-xl font-black text-ink">No units yet</h2><p className="mt-2 font-bold text-mutedText">Add estate units before taking readings or billing tenants.</p><div className="mt-4"><SecondaryButton href="/admin/units">Open units</SecondaryButton></div></section> : null}
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      <StatCard href="/admin/periods" label="Current Period" value={period?.name ?? "No active period"} hint={period?.status ?? "Setup required"} icon={ClipboardCheck} tone="green" />
      <StatCard href={withSelectedPeriod("/admin/readings/list", period?.id)} label="Reading Progress" value={period ? `${readingsComplete} / ${requiredUnits.length}` : "0 / 0"} hint={period ? "meters read" : "No billing period"} icon={Gauge} tone="blue" />
      <div className="rounded-2xl border border-slateLine bg-card p-5 shadow-soft"><div className="flex items-start justify-between gap-4"><p className="text-sm font-semibold text-secondaryText">Billing Status</p><div className={`rounded-xl p-3 ${readyToIssue ? "bg-estate-500/10 text-estate-500" : "bg-violet-500/10 text-violet-400"}`}><ReceiptText className="h-6 w-6" /></div></div><div className="mt-4 text-2xl font-black text-ink">{billingStatus}</div><p className="mt-2 text-sm font-medium text-mutedText">{billingHint}</p>{readyToIssue && period ? <form action={issueBills} className="mt-4"><input type="hidden" name="periodId" value={period.id} /><button className="tap-target w-full rounded-xl bg-estate-500 px-4 font-black text-[#07110b]">Issue Bills</button></form> : null}</div>
      <StatCard href="/admin/units?status=active" label="Active Units" value={units.filter((unit) => unit.status === "active").length} hint={units.length ? "Tenant meters live" : "No units"} icon={Users} tone="green" />
      <StatCard href={withSelectedPeriod("/admin/landlord?filter=outstanding", period?.id)} label="Outstanding" value={formatMoney(totalOutstanding)} hint={bills.length ? "Unpaid and part paid" : "No bills"} icon={TrendingUp} tone="warning" />
      <StatCard href="/admin/bills" label="Bills Issued" value={`${periodBills.length} / ${units.length}`} hint={period?.name ?? "No bills ready"} icon={CheckCircle2} tone="green" />
      <StatCard href="/admin/sms" label="SMS Sent" value={smsLogs.length} hint={smsLogs.length ? "Open SMS overview" : "No SMS logs"} icon={MessageSquare} tone="blue" />
    </section>
    <section className="mt-6 rounded-2xl border border-slateLine bg-card p-6 shadow-soft"><h2 className="text-2xl font-black text-ink">Quick actions</h2><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><PrimaryButton href={withSelectedPeriod("/admin/readings", period?.id)}><Gauge className="h-5 w-5" />Enter Readings</PrimaryButton><SecondaryButton href={withSelectedPeriod("/admin/bills/review", period?.id)}><ReceiptText className="h-5 w-5" />Review Bills</SecondaryButton><SecondaryButton href={withSelectedPeriod("/admin/bills/review", period?.id)}><CheckCircle2 className="h-5 w-5" />Issue Bills</SecondaryButton><SecondaryButton href="/admin/payments"><CreditCard className="h-5 w-5" />Payments</SecondaryButton><SecondaryButton href={withSelectedPeriod("/admin/landlord?filter=outstanding", period?.id)}><TrendingUp className="h-5 w-5" />Outstanding</SecondaryButton><SecondaryButton href="/admin/reports"><BarChart3 className="h-5 w-5" />Reports</SecondaryButton></div></section>
    <section className="mt-6"><h2 className="mb-3 text-xl font-black text-ink">Recent payments</h2><DataTable><thead><tr><Th>Unit</Th><Th>Amount</Th><Th>Method</Th><Th>Date</Th></tr></thead><tbody>{payments.length ? payments.slice(0, 6).map((payment) => { const unit = units.find((item) => item.id === payment.unitId); return <tr key={payment.id}><Td strong>{unit?.unitReference ?? "-"}</Td><Td>{formatMoney(payment.amountPence)}</Td><Td>{payment.paymentMethod.replace("_", " ")}</Td><Td>{payment.paymentDate}</Td></tr>; }) : <EmptyRow colSpan={4}>No payments recorded yet.</EmptyRow>}</tbody></DataTable></section>
  </>;
}