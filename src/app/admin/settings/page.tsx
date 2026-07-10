import { PageHeader, PrimaryButton } from "@/components/ui";
import { saveEstateSettings, savePaymentInstructionsAction } from "@/lib/actions";
import { getSmsTemplates } from "@/lib/sms-templates";
import { SmsTemplateSettings } from "./sms-template-settings";
import { getAppData } from "@/lib/data";
import { getPaymentInstructions } from "@/lib/payment-instructions";
import { Save } from "lucide-react";

const fieldClass = "rounded-2xl border border-slateLine bg-sidebar p-4 text-ink outline-none transition placeholder:text-mutedText focus:border-estate-500";
const labelClass = "grid gap-2 text-sm font-bold text-secondaryText";

export default async function SettingsPage() {
  const { estate } = await getAppData();
  const smsTemplates = await getSmsTemplates();
  const paymentInstructions = await getPaymentInstructions();
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
      <form action={savePaymentInstructionsAction} className="mt-6 grid gap-4 rounded-2xl border border-slateLine bg-card p-6 shadow-soft">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-estate-500">Online Bill Access</p>
          <h2 className="mt-1 text-2xl font-black text-ink">Payment instructions</h2>
          <p className="mt-1 text-sm font-bold text-secondaryText">Shown on tenant secure bill pages below the bill breakdown. Useful for bank details, payment reference wording, or a future payment link.</p>
        </div>
        <textarea name="paymentInstructions" className={`${fieldClass} min-h-40`} defaultValue={paymentInstructions} />
        <p className="text-sm font-bold text-mutedText">Available placeholders: {"{{estateName}}"}, {"{{tenantName}}"}, {"{{unitNumber}}"}, {"{{amount}}"}, {"{{paymentLink}}"}</p>
        <div><PrimaryButton><Save className="h-5 w-5" />Save payment instructions</PrimaryButton></div>
      </form>
      <SmsTemplateSettings templates={smsTemplates} />
    </>
  );
}
