import { DataTable, PageHeader, PrimaryButton, StatusPill, Td, Th } from "@/components/ui";
import { saveBillingPeriod } from "@/lib/actions";
import { getAppData } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { Plus, Save } from "lucide-react";

const inputClass = "rounded-2xl border border-slateLine bg-sidebar p-4 font-bold text-ink outline-none transition focus:border-estate-500";

export default async function PeriodsPage() {
  const { estate, billingPeriods } = await getAppData();
  return (
    <>
      <PageHeader title="Billing periods" eyebrow="Monthly setup" action={<PrimaryButton><Plus className="h-5 w-5" />Create below</PrimaryButton>} />
      <DataTable><thead><tr><Th>Name</Th><Th>Dates</Th><Th>Status</Th><Th>kWh rate</Th><Th>Standing</Th><Th>Issued</Th></tr></thead><tbody>{billingPeriods.map((period) => (<tr key={period.id}><Td strong>{period.name}</Td><Td>{period.startDate} to {period.endDate}</Td><Td><StatusPill tone={period.status === "issued" ? "good" : "warn"}>{period.status}</StatusPill></Td><Td>{formatMoney(period.kwhRatePence)}</Td><Td>{formatMoney(period.standingChargePence)}</Td><Td>{period.issuedAt ? new Date(period.issuedAt).toLocaleString("en-GB") : "-"}</Td></tr>))}</tbody></DataTable>
      <section className="mt-6 rounded-2xl border border-slateLine bg-card p-6 shadow-soft"><h2 className="text-xl font-black text-ink">New period defaults</h2><form action={saveBillingPeriod} className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><input type="hidden" name="estateId" value={estate.id} /><input name="name" className={inputClass} defaultValue="1st July - 31st July 2026" /><input name="startDate" className={inputClass} type="date" defaultValue="2026-07-01" /><input name="endDate" className={inputClass} type="date" defaultValue="2026-07-31" /><input name="kwhRate" className={inputClass} defaultValue={(estate.defaultKwhRatePence / 100).toFixed(2)} /><input name="standingCharge" className={inputClass} defaultValue={(estate.defaultStandingChargePence / 100).toFixed(2)} /><input name="levy" className={inputClass} defaultValue={(estate.defaultLevyPence / 100).toFixed(2)} /><PrimaryButton><Save className="h-5 w-5" />Save draft</PrimaryButton></form></section>
    </>
  );
}
