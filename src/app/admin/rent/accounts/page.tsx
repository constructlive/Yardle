import { PageHeader, PrimaryButton, StatusPill } from "@/components/ui";
import { saveRentAccount } from "@/lib/actions";
import { getAppData } from "@/lib/data";
import { formatAccountBalance } from "@/lib/money";
import { penceToPoundsInput, rentFrequencyLabel, todayIso } from "@/lib/rent";
import { Save, Users } from "lucide-react";

export const dynamic = "force-dynamic";

const fieldClass = "h-12 rounded-xl border border-slateLine bg-sidebar px-3 font-bold text-ink outline-none transition focus:border-amber-400";

export default async function RentAccountsPage() {
  const { units, rentAccounts, rentAccountUnits, rentServices, rentCharges, rentPayments } = await getAppData();
  const manageableUnits = units.filter((unit) => unit.status !== "inactive" && unit.status !== "not_used");
  const unassignedUnitIds = new Set(rentAccountUnits.map((link) => link.unitId));

  return <>
    <PageHeader title="Rent Accounts" eyebrow="Rent Management" action={<PrimaryButton href="/admin/rent/services">Manage services</PrimaryButton>} />
    <section className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-bold leading-6 text-amber-100 shadow-soft">
      Use rent accounts for businesses that pay one rent figure across multiple units. Electricity remains separate for each unit.
    </section>
    <form action={saveRentAccount} className="mb-6 rounded-2xl border border-slateLine bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500/10 text-amber-300"><Users className="h-5 w-5" /></div><div><h2 className="text-2xl font-black text-ink">Create rent account</h2><p className="text-sm font-bold text-mutedText">Tick all units that belong to this account.</p></div></div>
      <div className="grid gap-3 lg:grid-cols-4">
        <label className="grid gap-2 text-sm font-black text-secondaryText">Account name<input name="name" placeholder="S6 Customs" className={fieldClass} /></label>
        <label className="grid gap-2 text-sm font-black text-secondaryText">Contact name<input name="contactName" className={fieldClass} /></label>
        <label className="grid gap-2 text-sm font-black text-secondaryText">Email<input name="email" type="email" className={fieldClass} /></label>
        <label className="grid gap-2 text-sm font-black text-secondaryText">Mobile<input name="mobile" className={fieldClass} /></label>
        <label className="grid gap-2 text-sm font-black text-secondaryText">Rent amount<input name="amount" inputMode="decimal" placeholder="1200.00" className={fieldClass} /></label>
        <label className="grid gap-2 text-sm font-black text-secondaryText">Opening arrears / credit<input name="openingBalance" inputMode="decimal" defaultValue="0.00" className={fieldClass} /></label>
        <label className="grid gap-2 text-sm font-black text-secondaryText">Rule<select name="frequency" defaultValue="calendar_month" className={fieldClass}><option value="calendar_month">Calendar monthly</option><option value="weekly_monday">Weekly Monday</option><option value="manual">Manual</option></select></label>
        <label className="grid gap-2 text-sm font-black text-secondaryText">Start date<input name="startDate" type="date" defaultValue={todayIso()} className={fieldClass} /></label>
        <label className="grid gap-2 text-sm font-black text-secondaryText">Monthly day<input name="dueDayOfMonth" defaultValue={1} inputMode="numeric" className={fieldClass} /></label>
        <label className="grid gap-2 text-sm font-black text-secondaryText lg:col-span-2">Notes<input name="notes" className={fieldClass} /></label>
        <label className="grid gap-2 text-sm font-black text-secondaryText">Enabled<span className="flex h-12 items-center gap-3 rounded-xl border border-slateLine bg-sidebar px-3"><input name="enabled" type="checkbox" defaultChecked className="h-6 w-6 accent-amber-400" />Track rent</span></label>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {manageableUnits.map((unit) => <label key={unit.id} className="flex min-h-12 items-center gap-3 rounded-xl border border-slateLine bg-sidebar px-3 text-sm font-black text-ink"><input name="unitIds" value={unit.id} type="checkbox" disabled={unassignedUnitIds.has(unit.id)} className="h-5 w-5 accent-amber-400 disabled:opacity-40" /><span>Unit {unit.unitReference}</span><span className="ml-auto text-xs text-mutedText">{unassignedUnitIds.has(unit.id) ? "Assigned" : unit.tenantName || "Vacant"}</span></label>)}
      </div>
      <button className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 font-black text-[#161006] transition hover:bg-amber-300"><Save className="h-5 w-5" />Save account</button>
    </form>
    <section className="grid gap-4">
      {rentAccounts.length ? rentAccounts.map((account) => {
        const links = rentAccountUnits.filter((link) => link.rentAccountId === account.id);
        const linkedUnits = links.map((link) => units.find((unit) => unit.id === link.unitId)).filter(Boolean);
        const services = rentServices.filter((service) => service.rentAccountId === account.id && service.status === "active");
        const unitIds = new Set(links.map((link) => link.unitId));
        const charged = rentCharges.filter((charge) => unitIds.has(charge.unitId) && charge.status !== "cancelled").reduce((sum, charge) => sum + charge.amountPence, 0);
        const paid = rentPayments.filter((payment) => unitIds.has(payment.unitId) && !payment.reversedAt).reduce((sum, payment) => sum + payment.amountPence, 0);
        const balance = account.openingBalancePence + charged - paid;
        return <form key={account.id} action={saveRentAccount} className="rounded-2xl border border-slateLine bg-card p-5 shadow-soft">
          <input type="hidden" name="accountId" value={account.id} />
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><h2 className="text-2xl font-black text-ink">{account.name}</h2><p className="mt-1 text-sm font-bold text-mutedText">Units: {linkedUnits.map((unit: any) => unit.unitReference).join(", ") || "No units linked"}</p><p className="mt-1 text-sm font-bold text-mutedText">Services: {services.map((service) => service.name).join(", ") || "None"}</p></div><div className="flex flex-wrap gap-2"><StatusPill tone={account.enabled ? "warn" : "neutral"}>{account.enabled ? rentFrequencyLabel(account.frequency) : "Disabled"}</StatusPill><StatusPill tone={balance > 0 ? "bad" : balance < 0 ? "info" : "good"}>{formatAccountBalance(balance)}</StatusPill></div></div>
          <div className="grid gap-3 lg:grid-cols-4">
            <label className="grid gap-2 text-sm font-black text-secondaryText">Account name<input name="name" defaultValue={account.name} className={fieldClass} /></label>
            <label className="grid gap-2 text-sm font-black text-secondaryText">Contact name<input name="contactName" defaultValue={account.contactName} className={fieldClass} /></label>
            <label className="grid gap-2 text-sm font-black text-secondaryText">Email<input name="email" type="email" defaultValue={account.email} className={fieldClass} /></label>
            <label className="grid gap-2 text-sm font-black text-secondaryText">Mobile<input name="mobile" defaultValue={account.mobile} className={fieldClass} /></label>
            <label className="grid gap-2 text-sm font-black text-secondaryText">Rent amount<input name="amount" defaultValue={penceToPoundsInput(account.amountPence)} inputMode="decimal" className={fieldClass} /></label>
            <label className="grid gap-2 text-sm font-black text-secondaryText">Opening arrears / credit<input name="openingBalance" defaultValue={penceToPoundsInput(account.openingBalancePence)} inputMode="decimal" className={fieldClass} /></label>
            <label className="grid gap-2 text-sm font-black text-secondaryText">Rule<select name="frequency" defaultValue={account.frequency} className={fieldClass}><option value="calendar_month">Calendar monthly</option><option value="weekly_monday">Weekly Monday</option><option value="manual">Manual</option></select></label>
            <label className="grid gap-2 text-sm font-black text-secondaryText">Start date<input name="startDate" type="date" defaultValue={account.startDate || todayIso()} className={fieldClass} /></label>
            <label className="grid gap-2 text-sm font-black text-secondaryText">Monthly day<input name="dueDayOfMonth" defaultValue={account.dueDayOfMonth ?? 1} inputMode="numeric" className={fieldClass} /></label>
            <label className="grid gap-2 text-sm font-black text-secondaryText lg:col-span-2">Notes<input name="notes" defaultValue={account.notes ?? ""} className={fieldClass} /></label>
            <label className="grid gap-2 text-sm font-black text-secondaryText">Enabled<span className="flex h-12 items-center gap-3 rounded-xl border border-slateLine bg-sidebar px-3"><input name="enabled" type="checkbox" defaultChecked={account.enabled} className="h-6 w-6 accent-amber-400" />Track rent</span></label>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {manageableUnits.map((unit) => {
              const linkedElsewhere = rentAccountUnits.some((link) => link.unitId === unit.id && link.rentAccountId !== account.id);
              return <label key={unit.id} className="flex min-h-12 items-center gap-3 rounded-xl border border-slateLine bg-sidebar px-3 text-sm font-black text-ink"><input name="unitIds" value={unit.id} type="checkbox" defaultChecked={unitIds.has(unit.id)} disabled={linkedElsewhere || unitIds.has(unit.id)} className="h-5 w-5 accent-amber-400 disabled:opacity-40" /><span>Unit {unit.unitReference}</span><span className="ml-auto text-xs text-mutedText">{unitIds.has(unit.id) ? "Linked" : linkedElsewhere ? "Assigned" : unit.tenantName || "Vacant"}</span></label>;
            })}
          </div>
          <button className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 font-black text-[#161006] transition hover:bg-amber-300"><Save className="h-5 w-5" />Save account</button>
        </form>;
      }) : <div className="rounded-2xl border border-slateLine bg-card p-10 text-center font-bold text-mutedText">No rent accounts yet. Create one above when a tenant pays rent across multiple units or services.</div>}
    </section>
  </>;
}
