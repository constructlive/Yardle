import { PageHeader, PrimaryButton, SecondaryButton, StatCard, StatusPill, DataTable, Th, Td } from "@/components/ui";
import { generateRentCharges } from "@/lib/actions";
import { getAppData } from "@/lib/data";
import { buildRentLedger, rentFrequencyLabel, rentStatusLabel, rentStatusTone } from "@/lib/rent";
import { formatAccountBalance, formatMoney } from "@/lib/money";
import { CalendarClock, HandCoins, Landmark, TrendingUp, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RentDashboardPage() {
  const { units, rentSettings, rentCharges, rentPayments } = await getAppData();
  const ledger = buildRentLedger(units, rentSettings, rentCharges, rentPayments);
  const configured = ledger.filter((row) => row.enabled);
  const openingArrears = ledger.reduce((sum, row) => sum + Math.max(0, row.openingBalancePence), 0);
  const outstanding = ledger.reduce((sum, row) => sum + Math.max(0, row.balancePence), 0);
  const credit = ledger.reduce((sum, row) => sum + Math.max(0, -row.balancePence), 0);
  const paid = rentPayments.filter((payment) => !payment.reversedAt).reduce((sum, payment) => sum + payment.amountPence, 0);
  const arrears = ledger.filter((row) => row.status === "arrears" || row.status === "due");

  return <>
    <PageHeader title="Rent Dashboard" eyebrow="Rent Management" action={<form action={generateRentCharges}><PrimaryButton><CalendarClock className="h-5 w-5" />Generate rent due</PrimaryButton></form>} />
    <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard label="Tracked units" value={`${configured.length} / ${ledger.length}`} hint="Units with rent enabled" icon={Users} tone="green" href="/admin/rent/settings" />
      <StatCard label="Outstanding rent" value={formatMoney(outstanding)} hint="Opening arrears plus generated rent" icon={TrendingUp} tone="danger" href="/admin/rent/arrears" />
      <StatCard label="Rent paid" value={formatMoney(paid)} hint="All recorded rent payments" icon={HandCoins} tone="green" href="/admin/rent/payments" />
      <StatCard label="Account credit" value={formatMoney(credit)} hint="Paid ahead" icon={Landmark} tone="blue" />
      <StatCard label="Opening arrears" value={formatMoney(openingArrears)} hint="Brought forward from existing books" icon={CalendarClock} tone="warning" href="/admin/rent/settings" />
    </section>
    <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <PrimaryButton href="/admin/rent/checklist"><HandCoins className="h-5 w-5" />Rent Checklist</PrimaryButton>
      <SecondaryButton href="/admin/rent/settings">Unit Rent Settings</SecondaryButton>
      <SecondaryButton href="/admin/rent/payments">Rent Payments</SecondaryButton>
      <SecondaryButton href="/admin/rent/arrears">Arrears</SecondaryButton>
    </section>
    <DataTable><thead><tr><Th>Unit</Th><Th>Tenant</Th><Th>Rent rule</Th><Th>Opening</Th><Th>Due / credit</Th><Th>Next due</Th><Th>Status</Th></tr></thead><tbody>{ledger.slice(0, 12).map((row) => <tr key={row.unit.id}><Td strong>{row.unit.unitReference}</Td><Td>{row.unit.tenantName || "Vacant"}</Td><Td>{row.enabled ? `${formatMoney(row.weeklyOrMonthlyRentPence)} ${rentFrequencyLabel(row.frequency)}` : "Not configured"}</Td><Td>{formatAccountBalance(row.openingBalancePence)}</Td><Td strong>{formatAccountBalance(row.balancePence)}</Td><Td>{row.nextDueDate}</Td><Td><StatusPill tone={rentStatusTone(row.status)}>{rentStatusLabel(row.status)}</StatusPill></Td></tr>)}</tbody></DataTable>
  </>;
}
