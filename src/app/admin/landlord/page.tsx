import { getAppData } from "@/lib/data";
import { getSelectedBillingPeriod } from "@/lib/selected-period";
import { compareUnitReferences } from "@/lib/unit-sort";
import { LandlordPaymentView } from "./landlord-payment-view";

export const dynamic = "force-dynamic";

export default async function LandlordPage({ searchParams }: { searchParams: { filter?: string; periodId?: string } }) {
  const { bills, billingPeriods, payments, units } = await getAppData();
  const period = getSelectedBillingPeriod(billingPeriods, searchParams.periodId);
  const periodBills = period ? bills.filter((bill) => bill.billingPeriodId === period.id) : bills;
  const rows = periodBills.map((bill) => {
    const unit = units.find((item) => item.id === bill.unitId);
    return { bill, unit, payments: payments.filter((payment) => payment.billId === bill.id) };
  }).sort((left, right) => compareUnitReferences(left.unit?.unitReference ?? "", right.unit?.unitReference ?? ""));

  return <LandlordPaymentView period={period} rows={rows} initialFilter={searchParams.filter === "outstanding" ? "outstanding" : "all"} />;
}