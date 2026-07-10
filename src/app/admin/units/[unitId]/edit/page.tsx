import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, PrimaryButton, SecondaryButton } from "@/components/ui";
import { archiveUnit, saveUnit } from "@/lib/actions";
import { SecureBillLinkControls } from "@/components/secure-bill-link-controls";
import { getTenantBillUrl } from "@/lib/secure-link";
import { getAppData, getUnitById } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { parseTenantMeta } from "@/lib/tenant-meta";
import { Trash2, Save } from "lucide-react";

const fieldClass = "rounded-2xl border border-slateLine bg-sidebar p-4 text-ink outline-none transition placeholder:text-mutedText focus:border-estate-500";
const labelClass = "grid gap-2 text-sm font-bold text-secondaryText";

export default async function EditTenantPage({ params }: { params: { unitId: string } }) {
  const [unit, { estate }] = await Promise.all([getUnitById(params.unitId), getAppData()]);
  if (!unit) notFound();
  const meta = parseTenantMeta(unit.notes);
  return (
    <>
      <PageHeader title={`Edit ${unit.tenantName || `Unit ${unit.unitReference}`}`} eyebrow="Super Admin tenant management" />
      <form action={saveUnit} className="grid gap-6">
        <input type="hidden" name="unitId" value={unit.id} />
        <input type="hidden" name="estateId" value={estate.id} />
        <section className="rounded-2xl border border-slateLine bg-card p-6 shadow-soft">
          <h2 className="text-2xl font-black text-ink">General Information</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className={labelClass}>Business Name<input name="tenantName" className={fieldClass} defaultValue={unit.tenantName} /></label>
            <label className={labelClass}>Contact Name<input name="tenantContactName" className={fieldClass} defaultValue={unit.tenantContactName} /></label>
            <label className={labelClass}>Email Address<input name="tenantEmail" className={fieldClass} defaultValue={unit.tenantEmail} /></label>
            <label className={labelClass}>Mobile Number<input name="tenantMobile" className={fieldClass} defaultValue={unit.tenantMobile} /></label>
            <label className={`${labelClass} md:col-span-2`}>Billing Address<textarea name="billingAddress" className={`${fieldClass} min-h-28`} defaultValue={meta.billingAddress} /></label>
          </div>
        </section>
        <section className="rounded-2xl border border-slateLine bg-card p-6 shadow-soft">
          <h2 className="text-2xl font-black text-ink">Unit Information</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className={labelClass}>Unit Reference<input name="unitReference" className={fieldClass} defaultValue={unit.unitReference} /></label>
            <label className={labelClass}>Unit Status<select name="status" className={fieldClass} defaultValue={unit.status}><option value="active">Active</option><option value="empty">Empty</option><option value="not_used">Not Used</option><option value="inactive">Inactive</option></select></label>
            <label className="flex min-h-16 items-center gap-3 rounded-2xl border border-slateLine bg-sidebar px-4 text-sm font-bold text-secondaryText"><input name="freeSupplyMeter" type="checkbox" defaultChecked={unit.freeSupplyMeter} className="h-6 w-6 accent-estate-500" />Free Supply Meter</label>
            <label className={`${labelClass} md:col-span-2`}>Notes<textarea name="notes" className={`${fieldClass} min-h-28`} defaultValue={meta.notes} /></label>
          </div>
        </section>
        <section className="rounded-2xl border border-slateLine bg-card p-6 shadow-soft">
          <h2 className="text-2xl font-black text-ink">Billing Settings</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className={labelClass}>Custom kWh Rate<input name="customKwhRate" className={fieldClass} defaultValue={unit.customKwhRatePence ? (unit.customKwhRatePence / 100).toFixed(2) : ""} /></label>
            <label className={labelClass}>Custom Standing Charge<input name="customStandingCharge" className={fieldClass} defaultValue={unit.customStandingChargePence ? (unit.customStandingChargePence / 100).toFixed(2) : ""} /></label>
            <label className={labelClass}>Opening Balance<input name="openingBalance" className={fieldClass} defaultValue={(unit.openingBalancePence / 100).toFixed(2)} /></label>
            <label className={labelClass}>Outstanding Balance<input name="outstandingBalance" className={fieldClass} defaultValue={(unit.currentBalancePence / 100).toFixed(2)} readOnly /></label>
            <label className={labelClass}>Current Balance<input name="currentBalance" className={fieldClass} defaultValue={(unit.currentBalancePence / 100).toFixed(2)} /></label>
          </div>
        </section>
        <section className="rounded-2xl border border-slateLine bg-card p-6 shadow-soft">
          <h2 className="text-2xl font-black text-ink">Online Bill Access</h2>
          <p className="mt-2 text-secondaryText">Passwordless access to this business's bills using one secure link.</p>
          <label className="mt-5 inline-flex min-h-16 items-center gap-3 rounded-2xl border border-slateLine bg-sidebar px-5 font-black text-ink"><input type="checkbox" name="tenantAccessEnabled" defaultChecked={unit.tenantAccessEnabled} className="h-6 w-6 accent-estate-500" />Online Bill Access enabled</label>
          <div className="mt-5"><SecureBillLinkControls unitId={unit.id} secureUrl={getTenantBillUrl(unit.tenantAccessToken)} enabled={unit.tenantAccessEnabled} email={unit.tenantEmail} /></div>
        </section>
        <div className="flex flex-wrap gap-3">
          <PrimaryButton><Save className="h-5 w-5" />Save Changes</PrimaryButton>
          <SecondaryButton href="/admin/units">Cancel</SecondaryButton>
        </div>
      </form>
      <form action={archiveUnit} className="mt-4"><input type="hidden" name="unitId" value={unit.id} /><button className="tap-target inline-flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 font-black text-red-400"><Trash2 className="h-5 w-5" />Delete Tenant</button></form>
    </>
  );
}





