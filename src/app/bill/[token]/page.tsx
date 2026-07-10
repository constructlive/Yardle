import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { getPublicBillData } from "@/lib/data";
import { formatMoney, formatNumber } from "@/lib/money";
import { renderPaymentInstructions } from "@/lib/payment-instructions";
import { CalendarDays, Download, Gauge, ReceiptText, WalletCards } from "lucide-react";

function MissingLink() {
  return <main className="flex min-h-screen items-center justify-center bg-canvas px-5 text-ink"><section className="max-w-lg text-center"><BrandLogo className="mx-auto h-20 w-64" /><h1 className="mt-8 text-3xl font-black">Bill link not found or expired</h1><p className="mt-3 text-lg text-secondaryText">Ask the estate office to send you a new secure bill link.</p></section></main>;
}

export default async function PublicBillPage({ params }: { params: { token: string } }) {
  const data = await getPublicBillData(params.token);
  if (!data) return <MissingLink />;
  const latestBill = data.bills[0];
  const latestPeriod = latestBill ? data.billingPeriods.find((period) => period.id === latestBill.billingPeriodId) : undefined;
  const paymentInstructions = latestBill
    ? renderPaymentInstructions(data.paymentInstructions, {
      estateName: data.estate.name,
      tenantName: data.unit.tenantName || "Tenant",
      unitNumber: data.unit.unitReference,
      amount: formatMoney(latestBill.remainingBalancePence),
      paymentLink: ""
    })
    : "";
  return <main className="min-h-screen bg-canvas text-ink">
    <header className="border-b border-slateLine bg-sidebar"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8"><BrandLogo className="h-14 w-44 rounded-xl" /><div className="text-right"><p className="font-black">{data.unit.tenantName}</p><p className="text-sm text-mutedText">Unit {data.unit.unitReference}</p></div></div></header>
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      {!latestBill || !latestPeriod ? <section className="rounded-2xl border border-slateLine bg-card p-8 text-center"><ReceiptText className="mx-auto h-10 w-10 text-estate-500" /><h1 className="mt-4 text-2xl font-black">No bills have been issued yet</h1></section> : <>
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-bold text-estate-500">Electricity bill</p><h1 className="mt-1 text-3xl font-black sm:text-4xl">{latestPeriod.name}</h1><p className="mt-2 text-secondaryText">{data.unit.tenantName} - Unit {data.unit.unitReference}</p></div><a href={`/bill/${params.token}/print`} className="tap-target inline-flex items-center gap-2 rounded-2xl bg-estate-500 px-5 py-3 font-black text-[#07110b] shadow-glow"><Download className="h-5 w-5" />Download PDF</a></div>
        <section className="mt-8 rounded-2xl border border-estate-500/30 bg-card p-6 shadow-glow sm:p-8"><p className="text-sm font-black uppercase text-secondaryText">Total due</p><p className="mt-2 text-5xl font-black sm:text-6xl">{formatMoney(latestBill.remainingBalancePence)}</p><p className="mt-3 capitalize text-secondaryText">Current balance - {latestBill.paidStatus.replace("_", " ")}</p></section>
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<Gauge />} label="Units used" value={`${formatNumber(latestBill.usage)} kWh`} />
          <Metric icon={<WalletCards />} label="Current balance" value={formatMoney(data.unit.currentBalancePence)} />
          <Metric icon={<CalendarDays />} label="Previous reading" value={formatNumber(latestBill.previousReading)} />
          <Metric icon={<ReceiptText />} label="Current reading" value={formatNumber(latestBill.currentReading)} />
        </section>
        <section className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]"><div className="rounded-2xl border border-slateLine bg-card p-6"><h2 className="text-xl font-black">Bill breakdown</h2><dl className="mt-5 divide-y divide-slateLine"><Row label="Price per kWh" value={formatMoney(latestBill.kwhRatePence)} /><Row label="Standing charge" value={formatMoney(latestBill.standingChargePence)} /><Row label="Outstanding balance" value={formatMoney(latestBill.outstandingCarriedForwardPence)} /><Row label="Bill total" value={formatMoney(latestBill.roundedTotalPence)} /><Row label="Amount paid" value={formatMoney(latestBill.amountPaidPence)} /></dl></div><aside className="rounded-2xl border border-slateLine bg-card p-6"><h2 className="text-xl font-black">Payment instructions</h2><InstructionText text={paymentInstructions} /><p className="mt-4 text-sm text-mutedText">Contact {data.estate.contactEmail}{data.estate.contactPhone ? ` or ${data.estate.contactPhone}` : ""}.</p></aside></section>
        <section className="mt-8"><h2 className="mb-4 text-xl font-black">Bill history</h2><div className="overflow-x-auto rounded-2xl border border-slateLine bg-card"><table className="w-full min-w-[36rem] text-left"><thead className="bg-sidebar text-sm text-secondaryText"><tr><th className="px-5 py-4">Period</th><th className="px-5 py-4">Total</th><th className="px-5 py-4">Paid</th><th className="px-5 py-4">Remaining</th><th className="px-5 py-4">Status</th></tr></thead><tbody className="divide-y divide-slateLine">{data.bills.map((bill) => { const period = data.billingPeriods.find((item) => item.id === bill.billingPeriodId); return <tr key={bill.id} className="hover:bg-hover"><td className="px-5 py-4 font-bold">{period?.name ?? "-"}</td><td className="px-5 py-4">{formatMoney(bill.roundedTotalPence)}</td><td className="px-5 py-4">{formatMoney(bill.amountPaidPence)}</td><td className="px-5 py-4 font-black">{formatMoney(bill.remainingBalancePence)}</td><td className="px-5 py-4 capitalize">{bill.paidStatus.replace("_", " ")}</td></tr>; })}</tbody></table></div></section>
      </>}
    </div><footer className="border-t border-slateLine px-5 py-7 text-center text-sm text-mutedText">Powered by Yardle</footer>
  </main>;
}

function InstructionText({ text }: { text: string }) { const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean); return <div className="mt-4 space-y-3 leading-7 text-secondaryText">{lines.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}</div>; }
function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="rounded-2xl border border-slateLine bg-card p-5"><span className="block h-6 w-6 text-estate-500">{icon}</span><p className="mt-4 text-sm font-bold text-mutedText">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4 py-4"><dt className="text-secondaryText">{label}</dt><dd className="font-black">{value}</dd></div>; }
