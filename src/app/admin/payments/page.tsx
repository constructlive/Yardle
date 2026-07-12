import { DataTable, PageHeader, PrimaryButton, StatCard, Td, Th } from "@/components/ui";
import { getAppData } from "@/lib/data";
import { formatMoney } from "@/lib/money";

export default async function PaymentsPage() {
  const { bills, payments, units } = await getAppData();
  const paid = payments.reduce((sum, payment) => sum + payment.amountPence, 0);
  const remaining = bills.reduce((sum, bill) => sum + Math.max(0, bill.remainingBalancePence), 0);
  const credit = bills.reduce((sum, bill) => sum + Math.max(0, -bill.remainingBalancePence), 0);
  return <><PageHeader title="Payments" eyebrow="Record cash, bank transfer, card or other" action={<PrimaryButton href="/admin/landlord">Payment Checklist</PrimaryButton>} /><section className="mb-6 grid gap-4 sm:grid-cols-3"><StatCard label="Recorded payments" value={formatMoney(paid)} /><StatCard label="Outstanding after payments" value={formatMoney(remaining)} /><StatCard label="Account credit" value={formatMoney(credit)} /><StatCard label="Part-paid bills" value={bills.filter((bill) => bill.paidStatus === "part_paid").length} /></section><DataTable><thead><tr><Th>Unit</Th><Th>Tenant</Th><Th>Amount</Th><Th>Method</Th><Th>Date</Th><Th>Notes</Th></tr></thead><tbody>{payments.map((payment) => { const unit = units.find((item) => item.id === payment.unitId); return <tr key={payment.id}><Td strong>{unit?.unitReference ?? "-"}</Td><Td>{unit?.tenantName ?? "-"}</Td><Td>{formatMoney(payment.amountPence)}</Td><Td>{payment.paymentMethod.replace("_", " ")}</Td><Td>{payment.paymentDate}</Td><Td>{payment.notes}</Td></tr>; })}</tbody></DataTable></>;
}


