import { PageHeader } from "@/components/ui";
import { getAppData } from "@/lib/data";
import { LandlordPaymentView } from "./landlord-payment-view";

export default async function LandlordPage({ searchParams }: { searchParams: { filter?: string } }) {
  const { bills, billingPeriods, payments, units } = await getAppData();
  const period = billingPeriods[0];
  const rows = bills.map((bill) => ({
    bill,
    unit: units.find((unit) => unit.id === bill.unitId)!,
    payment: payments.find((payment) => payment.billId === bill.id)
  }));
  return <><PageHeader title="Landlord View" eyebrow="Simple payment checklist" /><LandlordPaymentView period={period} rows={rows} initialFilter={searchParams.filter === "outstanding" ? "outstanding" : "all"} /></>;
}
