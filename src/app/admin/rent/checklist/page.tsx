import { PageHeader, PrimaryButton, SecondaryButton, StatusPill } from "@/components/ui";
import { generateRentCharges, saveRentPayment } from "@/lib/actions";
import { getAppData } from "@/lib/data";
import { buildRentLedger, rentFrequencyLabel, rentStatusLabel, rentStatusTone, todayIso } from "@/lib/rent";
import { formatAccountBalance, formatMoney } from "@/lib/money";
import { getSmsTemplates } from "@/lib/sms-templates";
import { RentReminderButton } from "../rent-reminder-button";
import { CalendarClock, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RentChecklistPage() {
  const { units, rentSettings, rentCharges, rentPayments } = await getAppData();
  const smsTemplates = await getSmsTemplates();
  const rentReminderTemplate = smsTemplates.find((template) => template.templateKey === "rent_reminder")?.body ?? "Rent reminder for Unit {{unitNumber}} covering {{periodFrom}} to {{periodTo}}. Total outstanding: {{amount}}. Please arrange payment.";
  const ledger = buildRentLedger(units, rentSettings, rentCharges, rentPayments).filter((row) => row.enabled || row.balancePence !== 0);
  const outstanding = ledger.reduce((sum, row) => sum + Math.max(0, row.balancePence), 0);

  return <>
    <PageHeader title="Rent Checklist" eyebrow="Rent Management" action={<form action={generateRentCharges}><PrimaryButton><CalendarClock className="h-5 w-5" />Generate rent due</PrimaryButton></form>} />
    <section className="mb-5 rounded-2xl border border-slateLine bg-card p-5 shadow-soft">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div><p className="text-sm font-black uppercase tracking-wide text-estate-500">Today&apos;s position</p><h2 className="mt-1 text-3xl font-black text-ink">{formatMoney(outstanding)} outstanding</h2><p className="mt-1 font-bold text-mutedText">Opening arrears plus generated rent charges minus recorded payments.</p></div>
        <SecondaryButton href="/admin/rent/settings">Edit rent settings</SecondaryButton>
      </div>
    </section>
    <section className="overflow-x-auto rounded-2xl border border-slateLine bg-card shadow-soft">
      <table className="min-w-[86rem] w-full divide-y divide-slateLine text-left text-sm [&_tbody_tr:nth-child(even)]:bg-white/[0.025] [&_tbody_tr:hover]:bg-hover">
        <thead className="sticky top-0 z-20 bg-sidebar text-secondaryText"><tr><th className="px-4 py-4">Status</th><th className="px-4 py-4">Unit</th><th className="px-4 py-4">Tenant</th><th className="px-4 py-4">Rent rule</th><th className="px-4 py-4">Opening</th><th className="px-4 py-4">Generated</th><th className="px-4 py-4">Paid</th><th className="px-4 py-4">Balance</th><th className="px-4 py-4">Record payment</th></tr></thead>
        <tbody className="divide-y divide-slateLine">{ledger.length ? ledger.map((row) => {
          const unitCharges = rentCharges.filter((charge) => charge.unitId === row.unit.id && charge.status !== "cancelled").sort((left, right) => left.dueDate.localeCompare(right.dueDate));
          const defaultPeriodFrom = unitCharges[0]?.dueDate || row.setting?.startDate || todayIso();
          const defaultPeriodTo = unitCharges[unitCharges.length - 1]?.dueDate || todayIso();
          return <tr key={row.unit.id}><td className="px-4 py-4"><StatusPill tone={rentStatusTone(row.status)}>{rentStatusLabel(row.status)}</StatusPill></td><td className="px-4 py-4 text-xl font-black text-ink">{row.unit.unitReference}</td><td className="px-4 py-4 font-bold text-secondaryText">{row.unit.tenantName || "Vacant"}</td><td className="px-4 py-4 text-secondaryText">{formatMoney(row.weeklyOrMonthlyRentPence)}<br /><span className="text-xs font-bold text-mutedText">{rentFrequencyLabel(row.frequency)} - next {row.nextDueDate}</span></td><td className="px-4 py-4 font-black text-ink">{formatAccountBalance(row.openingBalancePence)}</td><td className="px-4 py-4 font-black text-ink">{formatMoney(row.chargedPence)}</td><td className="px-4 py-4 font-black text-ink">{formatMoney(row.paidPence)}</td><td className={`px-4 py-4 font-black ${row.balancePence > 0 ? "text-amber-400" : row.balancePence < 0 ? "text-blue-300" : "text-estate-500"}`}>{formatAccountBalance(row.balancePence)}</td><td className="px-4 py-4"><div className="grid min-w-[34rem] gap-2"><form action={saveRentPayment} className="grid grid-cols-[1fr_1fr_auto] gap-2"><input type="hidden" name="unitId" value={row.unit.id} /><input name="amount" defaultValue={(Math.max(0, row.balancePence) / 100).toFixed(2)} inputMode="decimal" className="h-12 rounded-xl border border-slateLine bg-sidebar px-3 text-base font-black text-ink outline-none focus:border-estate-500" /><select name="paymentMethod" defaultValue="bank_transfer" className="h-12 rounded-xl border border-slateLine bg-sidebar px-3 font-black text-ink outline-none focus:border-estate-500"><option value="bank_transfer">Bank Transfer</option><option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option></select><button className="inline-flex h-12 items-center gap-2 rounded-xl bg-estate-500 px-4 font-black text-[#07110b]"><CheckCircle2 className="h-5 w-5" />Record</button><input type="date" name="paymentDate" defaultValue={todayIso()} className="h-12 rounded-xl border border-slateLine bg-sidebar px-3 font-bold text-ink outline-none focus:border-estate-500" /><input name="notes" placeholder="Notes" className="col-span-2 h-12 rounded-xl border border-slateLine bg-sidebar px-3 font-bold text-ink outline-none focus:border-estate-500" /></form>{row.balancePence > 0 ? <RentReminderButton unitId={row.unit.id} unitReference={row.unit.unitReference} tenantName={row.unit.tenantName || "Vacant"} mobile={row.unit.tenantMobile} totalOutstanding={formatMoney(row.balancePence)} defaultPeriodFrom={defaultPeriodFrom} defaultPeriodTo={defaultPeriodTo} templateBody={rentReminderTemplate} /> : null}</div></td></tr>;
        }) : <tr><td colSpan={9} className="px-4 py-10 text-center font-bold text-mutedText">No rent units are configured yet. Open Unit Rent Settings to enable rent tracking.</td></tr>}</tbody>
      </table>
    </section>
  </>;
}
