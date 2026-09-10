import { BrandLogo } from "@/components/brand-logo";
import { getPublicBillData } from "@/lib/data";
import { formatAccountBalance, formatMoney } from "@/lib/money";
import { notFound } from "next/navigation";
import { PrintStatementButton } from "./print-statement-button";

export const dynamic = "force-dynamic";

type StatementSearchParams = {
  periodId?: string | string[];
};

function selectedPeriodIds(searchParams: StatementSearchParams) {
  const value = searchParams.periodId;
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function periodDate(period?: { startDate: string; endDate: string }) {
  if (!period) return "";
  return `${new Date(period.startDate).toLocaleDateString("en-GB")} - ${new Date(period.endDate).toLocaleDateString("en-GB")}`;
}

function broughtForwardLabel(pence: number) {
  if (pence < 0) return "Credit brought forward";
  if (pence > 0) return "Previous unpaid balance";
  return "Previous balance";
}

function paymentMethodLabel(method: string) {
  return method.replaceAll("_", " ");
}

export default async function StatementPage({ params, searchParams }: { params: { token: string }; searchParams: StatementSearchParams }) {
  const data = await getPublicBillData(params.token);
  if (!data) notFound();

  const selectedIds = new Set(selectedPeriodIds(searchParams));
  const statementBills = data.bills
    .filter((bill) => selectedIds.size === 0 || selectedIds.has(bill.billingPeriodId))
    .sort((a, b) => {
      const periodA = data.billingPeriods.find((period) => period.id === a.billingPeriodId);
      const periodB = data.billingPeriods.find((period) => period.id === b.billingPeriodId);
      return String(periodA?.startDate ?? "").localeCompare(String(periodB?.startDate ?? ""));
    });

  const includedBillIds = new Set(statementBills.map((bill) => bill.id));
  const payments = data.payments
    .filter((payment) => includedBillIds.has(payment.billId) && !payment.reversedAt)
    .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));

  const thisMonthTotal = statementBills.reduce((sum, bill) => sum + bill.subtotalPence, 0);
  const billTotal = statementBills.reduce((sum, bill) => sum + bill.roundedTotalPence, 0);
  const paidTotal = statementBills.reduce((sum, bill) => sum + bill.amountPaidPence, 0);
  const finalBalance = statementBills.length ? statementBills[statementBills.length - 1].remainingBalancePence : data.unit.currentBalancePence;
  const rangeLabel = statementBills.length
    ? `${data.billingPeriods.find((period) => period.id === statementBills[0].billingPeriodId)?.name ?? "First selected bill"} to ${data.billingPeriods.find((period) => period.id === statementBills[statementBills.length - 1].billingPeriodId)?.name ?? "latest selected bill"}`
    : "No billing cycles selected";

  return (
    <main className="min-h-screen bg-canvas p-4 text-ink sm:p-8 print:bg-white print:p-0 print:text-[#17212b]">
      <section className="mx-auto max-w-6xl rounded-2xl border border-slateLine bg-card p-5 shadow-soft sm:p-8 print:border-0 print:bg-white print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slateLine pb-5 print:border-[#d8e0e6]">
          <div>
            <BrandLogo className="h-14 w-44 print:hidden" />
            <h1 className="mt-5 text-3xl font-black print:mt-0 print:text-2xl">Yardle account statement</h1>
            <p className="mt-2 font-bold text-secondaryText print:text-[#44515f]">{data.unit.tenantName || "Tenant"} - Unit {data.unit.unitReference}</p>
            <p className="mt-1 text-sm text-mutedText print:text-[#526170]">{rangeLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a href={`/bill/${params.token}`} className="tap-target rounded-2xl border border-slateLine bg-sidebar px-5 py-3 font-black text-ink print:hidden">Back to bill</a>
            <PrintStatementButton />
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-4 print:grid-cols-4">
          <StatementMetric label="This month's charges" value={formatMoney(thisMonthTotal)} />
          <StatementMetric label="Bill totals" value={formatMoney(billTotal)} />
          <StatementMetric label="Payments received" value={formatMoney(paidTotal)} />
          <StatementMetric label={finalBalance < 0 ? "Credit remaining" : "Final balance"} value={formatAccountBalance(finalBalance)} highlight />
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-black">Billing cycles included</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slateLine print:border-[#d8e0e6]">
            <table className="w-full min-w-[58rem] text-left text-sm">
              <thead className="bg-sidebar text-secondaryText print:bg-[#eef2f5] print:text-[#17212b]"><tr><th className="px-4 py-3">Period</th><th className="px-4 py-3">This month</th><th className="px-4 py-3">Brought forward</th><th className="px-4 py-3">Bill total</th><th className="px-4 py-3">Paid</th><th className="px-4 py-3">Balance</th><th className="px-4 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-slateLine print:divide-[#d8e0e6]">
                {statementBills.length ? statementBills.map((bill) => {
                  const period = data.billingPeriods.find((item) => item.id === bill.billingPeriodId);
                  return <tr key={bill.id}><td className="px-4 py-3 font-bold">{period?.name ?? "-"}<br /><span className="text-xs font-semibold text-mutedText print:text-[#526170]">{periodDate(period)}</span></td><td className="px-4 py-3">{formatMoney(bill.subtotalPence)}</td><td className="px-4 py-3"><span className="block text-xs text-mutedText print:text-[#526170]">{broughtForwardLabel(bill.outstandingCarriedForwardPence)}</span>{formatAccountBalance(bill.outstandingCarriedForwardPence)}</td><td className="px-4 py-3">{formatMoney(bill.roundedTotalPence)}</td><td className="px-4 py-3">{formatMoney(bill.amountPaidPence)}</td><td className="px-4 py-3 font-black">{formatAccountBalance(bill.remainingBalancePence)}</td><td className="px-4 py-3 capitalize">{bill.paidStatus.replace("_", " ")}</td></tr>;
                }) : <tr><td colSpan={7} className="px-4 py-8 text-center font-bold text-mutedText">No billing cycles selected.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-black">Payments included</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slateLine print:border-[#d8e0e6]">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="bg-sidebar text-secondaryText print:bg-[#eef2f5] print:text-[#17212b]"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Method</th><th className="px-4 py-3">Notes</th></tr></thead>
              <tbody className="divide-y divide-slateLine print:divide-[#d8e0e6]">
                {payments.length ? payments.map((payment) => <tr key={payment.id}><td className="px-4 py-3 font-bold">{new Date(payment.paymentDate).toLocaleDateString("en-GB")}</td><td className="px-4 py-3 font-black">{formatMoney(payment.amountPence)}</td><td className="px-4 py-3 capitalize">{paymentMethodLabel(payment.paymentMethod)}</td><td className="px-4 py-3 text-secondaryText print:text-[#44515f]">{payment.notes || "-"}</td></tr>) : <tr><td colSpan={4} className="px-4 py-8 text-center font-bold text-mutedText">No payments recorded for the selected billing cycles.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

function StatementMetric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return <div className="rounded-2xl border border-slateLine bg-sidebar p-4 print:border-[#d8e0e6] print:bg-[#f7f9fb]"><p className="text-xs font-black uppercase text-mutedText print:text-[#526170]">{label}</p><p className={`mt-2 text-2xl font-black ${highlight ? "text-estate-500 print:text-[#0f6f5f]" : "text-ink print:text-[#17212b]"}`}>{value}</p></div>;
}
