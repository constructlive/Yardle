import { DataTable, PageHeader, PrimaryButton, Td, Th } from "@/components/ui";
import { getAppData } from "@/lib/data";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function RentPaymentsPage() {
  const { units, rentPayments } = await getAppData();
  const activePayments = rentPayments.filter((payment) => !payment.reversedAt);
  const total = activePayments.reduce((sum, payment) => sum + payment.amountPence, 0);
  return <>
    <PageHeader title="Rent Payments" eyebrow="Rent Management" action={<PrimaryButton href="/admin/rent/checklist">Record rent payment</PrimaryButton>} />
    <section className="mb-5 rounded-2xl border border-slateLine bg-card p-5 shadow-soft"><p className="text-sm font-black uppercase tracking-wide text-estate-500">Total recorded</p><h2 className="mt-1 text-3xl font-black text-ink">{formatMoney(total)}</h2></section>
    <DataTable><thead><tr><Th>Unit</Th><Th>Tenant</Th><Th>Amount</Th><Th>Method</Th><Th>Date</Th><Th>Notes</Th></tr></thead><tbody>{activePayments.length ? activePayments.map((payment) => { const unit = units.find((item) => item.id === payment.unitId); return <tr key={payment.id}><Td strong>{unit?.unitReference ?? "-"}</Td><Td>{unit?.tenantName || "Vacant"}</Td><Td strong>{formatMoney(payment.amountPence)}</Td><Td>{payment.paymentMethod.replace("_", " ")}</Td><Td>{payment.paymentDate}</Td><Td>{payment.notes ?? "-"}</Td></tr>; }) : <tr><td colSpan={6} className="px-4 py-10 text-center font-bold text-mutedText">No rent payments have been recorded yet.</td></tr>}</tbody></DataTable>
  </>;
}