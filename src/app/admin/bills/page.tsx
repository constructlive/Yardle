import { DataTable, PageHeader, PrimaryButton, StatusPill, Td, Th } from "@/components/ui";
import { getAppData } from "@/lib/data";
import { formatAccountBalance, formatMoney, formatNumber } from "@/lib/money";

export default async function BillsPage() {
  const { bills, billingPeriods, units } = await getAppData();
  return <><PageHeader title="Bills" eyebrow="Issued electricity bills" action={<PrimaryButton href="/admin/bills/review">Review draft</PrimaryButton>} /><DataTable><thead><tr><Th>Unit</Th><Th>Tenant</Th><Th>Period</Th><Th>Usage</Th><Th>Total</Th><Th>Paid</Th><Th>Balance</Th><Th>Status</Th></tr></thead><tbody>{bills.map((bill) => { const unit = units.find((item) => item.id === bill.unitId); const period = billingPeriods.find((item) => item.id === bill.billingPeriodId); return <tr key={bill.id}><Td strong>{unit?.unitReference ?? "-"}</Td><Td>{unit?.tenantName ?? "-"}</Td><Td>{period?.name ?? "-"}</Td><Td>{formatNumber(bill.usage)} kWh</Td><Td>{formatMoney(bill.roundedTotalPence)}</Td><Td>{formatMoney(bill.amountPaidPence)}</Td><Td>{formatAccountBalance(bill.remainingBalancePence)}</Td><Td><StatusPill tone={bill.paidStatus === "paid" ? "good" : bill.paidStatus === "credited" ? "info" : bill.paidStatus === "part_paid" ? "warn" : "bad"}>{bill.paidStatus.replace("_", " ")}</StatusPill></Td></tr>; })}</tbody></DataTable></>;
}

