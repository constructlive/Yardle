import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, PrimaryButton, StatCard, StatusPill } from "@/components/ui";
import { getUnitById } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { parseTenantMeta } from "@/lib/tenant-meta";
import { Edit3, Mail, Phone, Wallet } from "lucide-react";

export default async function ViewTenantPage({ params }: { params: { unitId: string } }) {
  const unit = await getUnitById(params.unitId);
  if (!unit) notFound();
  const meta = parseTenantMeta(unit.notes);
  return (
    <>
      <PageHeader title={unit.tenantName || `Unit ${unit.unitReference}`} eyebrow={`Unit ${unit.unitReference}`} action={<PrimaryButton href={`/admin/units/${unit.id}/edit`}><Edit3 className="h-5 w-5" />Edit</PrimaryButton>} />
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Outstanding Balance" value={formatMoney(unit.currentBalancePence)} icon={Wallet} tone={unit.currentBalancePence > 0 ? "warning" : "green"} />
        <StatCard label="Online Bill Access" value={unit.tenantAccessEnabled ? "Enabled" : "Disabled"} hint={unit.tenantEmail || "No email address"} icon={Mail} tone={unit.tenantAccessEnabled ? "green" : "warning"} />
        <StatCard label="Status" value={unit.status.replace("_", " ")} hint={unit.freeSupplyMeter ? "Free supply meter" : "Standard meter"} icon={Phone} tone={unit.status === "active" ? "green" : "warning"} />
      </section>
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slateLine bg-card p-6 shadow-soft"><h2 className="text-xl font-black text-ink">General Information</h2><dl className="mt-4 grid gap-3 text-secondaryText"><div><dt className="text-sm font-bold text-mutedText">Contact</dt><dd className="font-bold">{unit.tenantContactName || "-"}</dd></div><div><dt className="text-sm font-bold text-mutedText">Email</dt><dd className="font-bold">{unit.tenantEmail || "-"}</dd></div><div><dt className="text-sm font-bold text-mutedText">Mobile</dt><dd className="font-bold">{unit.tenantMobile || "-"}</dd></div><div><dt className="text-sm font-bold text-mutedText">Billing Address</dt><dd className="font-bold whitespace-pre-wrap">{meta.billingAddress || "-"}</dd></div></dl></div>
        <div className="rounded-2xl border border-slateLine bg-card p-6 shadow-soft"><h2 className="text-xl font-black text-ink">Billing Settings</h2><dl className="mt-4 grid gap-3 text-secondaryText"><div><dt className="text-sm font-bold text-mutedText">Custom kWh Rate</dt><dd className="font-bold">{unit.customKwhRatePence ? formatMoney(unit.customKwhRatePence) : "Default"}</dd></div><div><dt className="text-sm font-bold text-mutedText">Custom Standing Charge</dt><dd className="font-bold">{unit.customStandingChargePence ? formatMoney(unit.customStandingChargePence) : "Default"}</dd></div><div><dt className="text-sm font-bold text-mutedText">Opening Balance</dt><dd className="font-bold">{formatMoney(unit.openingBalancePence)}</dd></div><div><dt className="text-sm font-bold text-mutedText">Current Balance</dt><dd className="font-bold">{formatMoney(unit.currentBalancePence)}</dd></div></dl></div>
      </section>
      <section className="mt-6 rounded-2xl border border-slateLine bg-card p-6 shadow-soft"><h2 className="text-xl font-black text-ink">Notes</h2><p className="mt-3 whitespace-pre-wrap text-secondaryText">{meta.notes || "No notes recorded."}</p></section>
      <Link href="/admin/units" className="mt-6 inline-flex font-bold text-estate-500">Back to Units / Tenants</Link>
    </>
  );
}


