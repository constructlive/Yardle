import { PageHeader, PrimaryButton } from "@/components/ui";
import { saveEstateSettings } from "@/lib/actions";
import { getSmsTemplates } from "@/lib/sms-templates";
import { SmsTemplateSettings } from "./sms-template-settings";
import { getAppData } from "@/lib/data";
import { Save } from "lucide-react";

const fieldClass = "rounded-2xl border border-slateLine bg-sidebar p-4 text-ink outline-none transition placeholder:text-mutedText focus:border-estate-500";
const labelClass = "grid gap-2 text-sm font-bold text-secondaryText";

export default async function SettingsPage() {
  const { estate } = await getAppData();
  const smsTemplates = await getSmsTemplates();
  return (
    <>
      <PageHeader title="Settings" eyebrow="Estate defaults for new billing periods" action={null} />
      <form action={saveEstateSettings} className="grid gap-5 rounded-2xl border border-slateLine bg-card p-6 shadow-soft md:grid-cols-2">
        <input type="hidden" name="estateId" value={estate.id} />
        <label className={labelClass}>Estate name<input name="name" className={fieldClass} defaultValue={estate.name} /></label>
        <label className={labelClass}>Contact email<input name="contactEmail" className={fieldClass} defaultValue={estate.contactEmail} /></label>
        <label className={labelClass}>Contact phone<input name="contactPhone" className={fieldClass} defaultValue={estate.contactPhone} /></label>
        <label className={labelClass}>SMS sender<input name="smsSenderName" className={fieldClass} defaultValue={estate.smsSenderName} maxLength={11} /></label>
        <label className={labelClass}>Default kWh rate<input name="defaultKwhRate" className={fieldClass} defaultValue={(estate.defaultKwhRatePence / 100).toFixed(2)} /></label>
        <label className={labelClass}>Default standing charge<input name="defaultStandingCharge" className={fieldClass} defaultValue={(estate.defaultStandingChargePence / 100).toFixed(2)} /></label>
        <label className={labelClass}>Default levy<input name="defaultLevy" className={fieldClass} defaultValue={(estate.defaultLevyPence / 100).toFixed(2)} /></label>
        <label className={`${labelClass} md:col-span-2`}>Address<textarea name="address" className={`${fieldClass} min-h-32`} defaultValue={estate.address} /></label>
        <div className="md:col-span-2"><PrimaryButton><Save className="h-5 w-5" />Save settings</PrimaryButton></div>
      </form>
          <SmsTemplateSettings templates={smsTemplates} />
    </>
  );
}

