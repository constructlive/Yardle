import { PageHeader, PrimaryButton, StatusPill } from "@/components/ui";
import { generateRentCharges, saveRentSetting } from "@/lib/actions";
import { getAppData } from "@/lib/data";
import { penceToPoundsInput, rentFrequencyLabel, todayIso } from "@/lib/rent";
import { Save } from "lucide-react";

export const dynamic = "force-dynamic";

const fieldClass = "h-12 rounded-xl border border-slateLine bg-sidebar px-3 font-bold text-ink outline-none transition focus:border-estate-500";

export default async function RentSettingsPage() {
  const { units, rentSettings } = await getAppData();
  const manageableUnits = units.filter((unit) => unit.status !== "inactive" && unit.status !== "not_used");

  return <>
    <PageHeader title="Unit Rent Settings" eyebrow="Rent Management" action={<form action={generateRentCharges}><PrimaryButton>Generate rent due</PrimaryButton></form>} />
    <section className="grid gap-4">
      {manageableUnits.map((unit) => {
        const setting = rentSettings.find((item) => item.unitId === unit.id);
        return <form key={unit.id} action={saveRentSetting} className="rounded-2xl border border-slateLine bg-card p-4 shadow-soft">
          <input type="hidden" name="unitId" value={unit.id} />
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.7fr_1fr_auto] xl:items-end">
            <div><p className="text-xs font-black uppercase tracking-wide text-estate-500">Unit {unit.unitReference}</p><h2 className="mt-1 text-xl font-black text-ink">{unit.tenantName || "Vacant"}</h2><p className="mt-1 text-sm font-bold text-mutedText">{unit.status.replace("_", " ")}</p></div>
            <label className="grid gap-2 text-sm font-black text-secondaryText">Enabled<span className="flex h-12 items-center gap-3 rounded-xl border border-slateLine bg-sidebar px-3"><input name="enabled" type="checkbox" defaultChecked={setting?.enabled ?? false} className="h-6 w-6 accent-estate-500" />Track rent</span></label>
            <label className="grid gap-2 text-sm font-black text-secondaryText">Rent amount<input name="amount" defaultValue={penceToPoundsInput(setting?.amountPence)} inputMode="decimal" className={fieldClass} /></label>
            <label className="grid gap-2 text-sm font-black text-secondaryText">Rule<select name="frequency" defaultValue={setting?.frequency ?? "weekly_monday"} className={fieldClass}><option value="weekly_monday">Weekly Monday</option><option value="calendar_month">Calendar monthly</option><option value="manual">Manual</option></select></label>
            <label className="grid gap-2 text-sm font-black text-secondaryText">Start date<input name="startDate" type="date" defaultValue={setting?.startDate || todayIso()} className={fieldClass} /></label>
            <label className="grid gap-2 text-sm font-black text-secondaryText">Monthly day<input name="dueDayOfMonth" defaultValue={setting?.dueDayOfMonth ?? 1} inputMode="numeric" className={fieldClass} /></label>
            <button className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-estate-500 px-4 font-black text-[#07110b]"><Save className="h-5 w-5" />Save</button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]"><input name="notes" defaultValue={setting?.notes ?? ""} placeholder="Notes or special rent arrangement" className={fieldClass} /><StatusPill tone={setting?.enabled ? "good" : "neutral"}>{setting?.enabled ? rentFrequencyLabel(setting.frequency) : "Not tracked"}</StatusPill></div>
        </form>;
      })}
    </section>
  </>;
}