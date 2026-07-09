import { DataTable, PageHeader, PrimaryButton, SecondaryButton, StatCard, Td, Th } from "@/components/ui";
import { issueBills } from "@/lib/actions";
import { getAppData } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { BarChart3, CheckCircle2, ClipboardCheck, CreditCard, Gauge, MessageSquare, ReceiptText, TrendingUp, Users } from "lucide-react";

export default async function AdminDashboard() {
  const { bills, billingPeriods, meterReadings, payments, smsLogs, units } = await getAppData();
  const period = billingPeriods.find((item) => item.status === "draft") ?? billingPeriods[0];
  const requiredUnits = units.filter((unit) => unit.status === "active" && !unit.freeSupplyMeter);
  const periodReadings = meterReadings.filter((reading) => reading.billingPeriodId === period.id);
  const readIds = new Set(periodReadings.map((reading) => reading.unitId));
  const readingsComplete = requiredUnits.filter((unit) => readIds.has(unit.id)).length;
  const readingsMissing = Math.max(0, requiredUnits.length - readingsComplete);
  const readyToIssue = period.status === "draft" && readingsMissing === 0;
  const periodBills = bills.filter((bill) => bill.billingPeriodId === period.id);
  const totalOutstanding = bills.reduce((sum, bill) => sum + bill.remainingBalancePence, 0);
  const latestIssued = billingPeriods.filter((item) => item.issuedAt).sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)))[0];

  return <>
    <PageHeader title="Dashboard" eyebrow="Yardle Industrial Estate" action={<PrimaryButton href="/admin/readings"><Gauge className="h-5 w-5" />Enter readings</PrimaryButton>} />
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      <StatCard href="/admin/periods" label="Current Period" value={period.name} hint={period.status} icon={ClipboardCheck} tone="green" />
      <StatCard href="/admin/readings/list" label="Reading Progress" value={`${readingsComplete} / ${requiredUnits.length}`} hint="meters read" icon={Gauge} tone="blue" />
      <div className="rounded-2xl border border-slateLine bg-card p-5 shadow-soft"><div className="flex items-start justify-between gap-4"><p className="text-sm font-semibold text-secondaryText">Billing Status</p><div className={`rounded-xl p-3 ${readyToIssue ? "bg-estate-500/10 text-estate-500" : "bg-violet-500/10 text-violet-400"}`}><ReceiptText className="h-6 w-6" /></div></div><div className="mt-4 text-2xl font-black text-ink">{readyToIssue ? "Ready to Issue" : period.status === "draft" ? "Draft" : "Issued"}</div><p className="mt-2 text-sm font-medium text-mutedText">{readingsMissing ? `${readingsMissing} readings missing` : latestIssued?.issuedAt ? `Last issued ${new Date(latestIssued.issuedAt).toLocaleString("en-GB")}` : "All readings complete"}</p>{readyToIssue ? <form action={issueBills} className="mt-4"><input type="hidden" name="periodId" value={period.id} /><button className="tap-target w-full rounded-xl bg-estate-500 px-4 font-black text-[#07110b]">Issue Bills</button></form> : null}</div>
      <StatCard href="/admin/units?status=active" label="Active Units" value={units.filter((unit) => unit.status === "active").length} hint="Tenant meters live" icon={Users} tone="green" />
      <StatCard href="/admin/landlord?filter=outstanding" label="Outstanding" value={formatMoney(totalOutstanding)} hint="Unpaid and part paid" icon={TrendingUp} tone="warning" />
      <StatCard href="/admin/bills" label="Bills Issued" value={`${periodBills.length} / ${units.length}`} hint={period.name} icon={CheckCircle2} tone="green" />
      <StatCard href="/admin/sms" label="SMS Sent" value={smsLogs.length} hint="Open SMS overview" icon={MessageSquare} tone="blue" />
    </section>
    <section className="mt-6 rounded-2xl border border-slateLine bg-card p-6 shadow-soft"><h2 className="text-2xl font-black text-ink">Quick actions</h2><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><PrimaryButton href="/admin/readings"><Gauge className="h-5 w-5" />Enter Readings</PrimaryButton><SecondaryButton href="/admin/bills/review"><ReceiptText className="h-5 w-5" />Review Bills</SecondaryButton><SecondaryButton href="/admin/bills/review"><CheckCircle2 className="h-5 w-5" />Issue Bills</SecondaryButton><SecondaryButton href="/admin/payments"><CreditCard className="h-5 w-5" />Payments</SecondaryButton><SecondaryButton href="/admin/landlord?filter=outstanding"><TrendingUp className="h-5 w-5" />Outstanding</SecondaryButton><SecondaryButton href="/admin/reports"><BarChart3 className="h-5 w-5" />Reports</SecondaryButton></div></section>
    <section className="mt-6"><h2 className="mb-3 text-xl font-black text-ink">Recent payments</h2><DataTable><thead><tr><Th>Unit</Th><Th>Amount</Th><Th>Method</Th><Th>Date</Th></tr></thead><tbody>{payments.slice(0, 6).map((payment) => { const unit = units.find((item) => item.id === payment.unitId); return <tr key={payment.id}><Td strong>{unit?.unitReference ?? "-"}</Td><Td>{formatMoney(payment.amountPence)}</Td><Td>{payment.paymentMethod.replace("_", " ")}</Td><Td>{payment.paymentDate}</Td></tr>; })}</tbody></DataTable></section>
  </>;
}