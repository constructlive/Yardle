import { DataTable, PageHeader, PrimaryButton, StatusPill, Td, Th } from "@/components/ui";
import { getAppData } from "@/lib/data";
import { buildRentLedger, rentFrequencyLabel, rentStatusLabel, rentStatusTone } from "@/lib/rent";
import { formatAccountBalance, formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function RentArrearsPage() {
  const { units, rentSettings, rentCharges, rentPayments } = await getAppData();
  const ledger = buildRentLedger(units, rentSettings, rentCharges, rentPayments).filter((row) => row.balancePence > 0);
  const total = ledger.reduce((sum, row) => sum + row.balancePence, 0);
  return <>
    <PageHeader title="Rent Arrears" eyebrow="Rent Management" action={<PrimaryButton href="/admin/rent/checklist">Open checklist</PrimaryButton>} />
    <section className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 shadow-soft"><p className="text-sm font-black uppercase tracking-wide text-red-300">Outstanding rent</p><h2 className="mt-1 text-3xl font-black text-ink">{formatMoney(total)}</h2></section>
    <DataTable><thead><tr><Th>Unit</Th><Th>Tenant</Th><Th>Rent rule</Th><Th>Charged</Th><Th>Paid</Th><Th>Outstanding</Th><Th>Status</Th></tr></thead><tbody>{ledger.length ? ledger.map((row) => <tr key={row.unit.id}><Td strong>{row.unit.unitReference}</Td><Td>{row.unit.tenantName || "Vacant"}</Td><Td>{formatMoney(row.weeklyOrMonthlyRentPence)} {rentFrequencyLabel(row.frequency)}</Td><Td>{formatMoney(row.chargedPence)}</Td><Td>{formatMoney(row.paidPence)}</Td><Td strong>{formatAccountBalance(row.balancePence)}</Td><Td><StatusPill tone={rentStatusTone(row.status)}>{rentStatusLabel(row.status)}</StatusPill></Td></tr>) : <tr><td colSpan={7} className="px-4 py-10 text-center font-bold text-mutedText">No rent arrears at the moment.</td></tr>}</tbody></DataTable>
  </>;
}