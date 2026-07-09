import Link from "next/link";
import { DataTable, PageHeader, PrimaryButton, StatusPill, Td, Th } from "@/components/ui";
import { archiveUnit, saveUnit } from "@/lib/actions";
import { getAppData } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { Trash2, Edit3, Eye, Plus, Search } from "lucide-react";

const inputClass = "w-full rounded-xl border border-slateLine bg-sidebar p-3 font-bold text-ink outline-none transition placeholder:text-mutedText focus:border-estate-500";
const filterOptions = ["all", "active", "empty", "not_used", "inactive"];

export default async function UnitsPage({ searchParams }: { searchParams?: { q?: string; status?: string } }) {
  const { estate, units } = await getAppData();
  const q = (searchParams?.q ?? "").toLowerCase().trim();
  const status = searchParams?.status ?? "all";
  const filteredUnits = units.filter((unit) => {
    const haystack = `${unit.unitReference} ${unit.tenantName} ${unit.tenantContactName}`.toLowerCase();
    return (!q || haystack.includes(q)) && (status === "all" || unit.status === status);
  });
  return (
    <>
      <PageHeader title="Units / Tenants" eyebrow="Super Admin tenant management" action={<PrimaryButton><Plus className="h-5 w-5" />Add unit below</PrimaryButton>} />
      <section className="mb-6 rounded-2xl border border-slateLine bg-card p-5 shadow-soft">
        <form className="grid gap-3 lg:grid-cols-[1fr_auto]" action="/admin/units">
          <label className="relative block"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-mutedText" /><input name="q" className={`${inputClass} pl-12`} defaultValue={searchParams?.q ?? ""} placeholder="Search by unit number, business name, or contact name" /></label>
          <button className="tap-target rounded-2xl bg-estate-500 px-5 py-3 font-black text-[#07110b] shadow-glow">Search</button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {filterOptions.map((option) => <Link key={option} href={`/admin/units?status=${option}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`tap-target rounded-2xl px-4 py-3 text-sm font-black ${status === option ? "bg-estate-500 text-[#07110b]" : "border border-slateLine bg-sidebar text-secondaryText hover:bg-hover hover:text-ink"}`}>{option === "all" ? "All" : option.replace("_", " ")}</Link>)}
        </div>
      </section>
      <section className="mb-6 rounded-2xl border border-slateLine bg-card p-5 shadow-soft">
        <h2 className="text-xl font-black text-ink">Add unit / tenant</h2>
        <form action={saveUnit} className="mt-4 grid gap-3 md:grid-cols-4">
          <input type="hidden" name="estateId" value={estate.id} />
          <input name="unitReference" className={inputClass} placeholder="Unit" required />
          <input name="tenantName" className={inputClass} placeholder="Business" />
          <input name="tenantContactName" className={inputClass} placeholder="Contact" />
          <input name="tenantEmail" className={inputClass} placeholder="Email" />
          <input name="tenantMobile" className={inputClass} placeholder="Mobile" />
          <select name="status" className={inputClass} defaultValue="active"><option value="active">Active</option><option value="empty">Empty</option><option value="not_used">Not Used</option><option value="inactive">Inactive</option></select>
          <input name="currentBalance" className={inputClass} placeholder="Current balance GBP" inputMode="decimal" />
          <label className="flex items-center gap-2 rounded-xl border border-slateLine bg-sidebar px-3 font-bold text-secondaryText"><input name="tenantAccessEnabled" type="checkbox" className="h-5 w-5 accent-estate-500" />Online Bill Access</label>
          
          <input name="billingAddress" className={`${inputClass} md:col-span-2`} placeholder="Billing address" />
          <input name="notes" className={`${inputClass} md:col-span-3`} placeholder="Notes" />
          <PrimaryButton>Save unit</PrimaryButton>
        </form>
      </section>
      <DataTable>
        <thead><tr><Th>Unit</Th><Th>Business</Th><Th>Contact</Th><Th>Mobile</Th><Th>Outstanding Balance</Th><Th>Online Bill Access</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
        <tbody>
          {filteredUnits.map((unit) => {
            return (
              <tr key={unit.id}>
                <Td strong>{unit.unitReference}</Td>
                <Td>{unit.tenantName || "-"}</Td>
                <Td>{unit.tenantContactName || "-"}</Td>
                <Td>{unit.tenantMobile || "-"}</Td>
                <Td strong>{formatMoney(unit.currentBalancePence)}</Td>
                <Td><StatusPill tone={unit.tenantAccessEnabled ? "good" : "neutral"}>{unit.tenantAccessEnabled ? "Enabled" : "Disabled"}</StatusPill></Td>
                <Td><StatusPill tone={unit.status === "active" ? "good" : unit.status === "empty" ? "warn" : "neutral"}>{unit.status.replace("_", " ")}</StatusPill></Td>
                <Td>
                  <div className="flex min-w-72 flex-wrap gap-2">
                    <Link href={`/admin/units/${unit.id}/edit`} className="tap-target inline-flex items-center gap-2 rounded-xl border border-slateLine bg-sidebar px-3 py-2 font-bold text-ink hover:bg-hover"><Edit3 className="h-4 w-4" />Edit</Link>
                    <Link href={`/admin/units/${unit.id}`} className="tap-target inline-flex items-center gap-2 rounded-xl border border-slateLine bg-sidebar px-3 py-2 font-bold text-ink hover:bg-hover"><Eye className="h-4 w-4" />View</Link>
                    <form action={archiveUnit}><input type="hidden" name="unitId" value={unit.id} /><button className="tap-target inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 font-bold text-red-400"><Trash2 className="h-4 w-4" />Delete</button></form>
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
    </>
  );
}




