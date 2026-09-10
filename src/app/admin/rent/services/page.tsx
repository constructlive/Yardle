import { DataTable, PageHeader, PrimaryButton, StatusPill, Td, Th } from "@/components/ui";
import { saveRentService } from "@/lib/actions";
import { getAppData } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { penceToPoundsInput, rentFrequencyLabel, todayIso } from "@/lib/rent";
import { Save } from "lucide-react";

export const dynamic = "force-dynamic";

const fieldClass = "h-12 rounded-xl border border-slateLine bg-sidebar px-3 font-bold text-ink outline-none transition focus:border-amber-400";

function serviceTypeLabel(value: string) {
  if (value === "parking_bay") return "Parking bay";
  if (value === "storage") return "Storage";
  if (value === "other") return "Other";
  return "Service";
}

export default async function RentServicesPage() {
  const { rentAccounts, rentServices } = await getAppData();
  return <>
    <PageHeader title="Services" eyebrow="Rent Management" action={<PrimaryButton href="/admin/rent/accounts">Rent accounts</PrimaryButton>} />
    <section className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-bold leading-6 text-amber-100 shadow-soft">
      Add parking bays, storage areas or other chargeable services here, then link each one to a rent account.
    </section>
    <form action={saveRentService} className="mb-6 rounded-2xl border border-slateLine bg-card p-5 shadow-soft">
      <h2 className="text-2xl font-black text-ink">Add service</h2>
      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <label className="grid gap-2 text-sm font-black text-secondaryText">Rent account<select name="rentAccountId" className={fieldClass}>{rentAccounts.length ? rentAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>) : <option value="">Create a rent account first</option>}</select></label>
        <label className="grid gap-2 text-sm font-black text-secondaryText">Service name<input name="name" placeholder="Parking Bay 1" className={fieldClass} /></label>
        <label className="grid gap-2 text-sm font-black text-secondaryText">Type<select name="serviceType" defaultValue="parking_bay" className={fieldClass}><option value="parking_bay">Parking bay</option><option value="storage">Storage</option><option value="service">Service</option><option value="other">Other</option></select></label>
        <label className="grid gap-2 text-sm font-black text-secondaryText">Amount<input name="amount" inputMode="decimal" placeholder="40.00" className={fieldClass} /></label>
        <label className="grid gap-2 text-sm font-black text-secondaryText">Rule<select name="frequency" defaultValue="calendar_month" className={fieldClass}><option value="calendar_month">Calendar monthly</option><option value="weekly_monday">Weekly Monday</option><option value="manual">Manual</option></select></label>
        <label className="grid gap-2 text-sm font-black text-secondaryText">Start date<input name="startDate" type="date" defaultValue={todayIso()} className={fieldClass} /></label>
        <label className="grid gap-2 text-sm font-black text-secondaryText">Monthly day<input name="dueDayOfMonth" defaultValue={1} inputMode="numeric" className={fieldClass} /></label>
        <label className="grid gap-2 text-sm font-black text-secondaryText">Status<select name="status" defaultValue="active" className={fieldClass}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <label className="grid gap-2 text-sm font-black text-secondaryText lg:col-span-3">Notes<input name="notes" className={fieldClass} /></label>
        <button className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 font-black text-[#161006] transition hover:bg-amber-300"><Save className="h-5 w-5" />Save service</button>
      </div>
    </form>
    <DataTable><thead><tr><Th>Service</Th><Th>Account</Th><Th>Type</Th><Th>Amount</Th><Th>Frequency</Th><Th>Status</Th></tr></thead><tbody>{rentServices.length ? rentServices.map((service) => { const account = rentAccounts.find((item) => item.id === service.rentAccountId); return <tr key={service.id}><Td strong>{service.name}</Td><Td>{account?.name ?? "No account"}</Td><Td>{serviceTypeLabel(service.serviceType)}</Td><Td strong>{formatMoney(service.amountPence)}</Td><Td>{rentFrequencyLabel(service.frequency)}</Td><Td><StatusPill tone={service.status === "active" ? "warn" : "neutral"}>{service.status}</StatusPill></Td></tr>; }) : <tr><td colSpan={6} className="px-4 py-10 text-center font-bold text-mutedText">No services have been added yet.</td></tr>}</tbody></DataTable>
  </>;
}
