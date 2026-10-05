import { notFound } from "next/navigation";

import { getTenantPortal } from "@/lib/tenant-portal/access";
import { formatMoney } from "@/lib/money";
import { card } from "@/components/rent-ledger/views";
export const dynamic="force-dynamic";
export const metadata={title:"Electricity bill | Yardle",robots:{index:false,follow:false},referrer:"no-referrer"};
export default async function Bill({params}:{params:{token:string;billId:string}}) {
  const p=await getTenantPortal(params.token);const b=p?.bills.find(b=>b.id===params.billId);if(!p||!b)notFound();
  return <main className="mx-auto max-w-2xl space-y-4 p-5 text-ink"><a href={`/account/${params.token}?tab=electricity`} className="underline">Back to electricity</a><section className={card}><h1 className="text-2xl font-bold">Electricity · {p.periods.find(x=>x.id===b.billingPeriodId)?.name}</h1><p>Unit {p.electricityUnits.find(u=>u.id===b.unitId)?.unitReference}</p><dl className="space-y-3">{[["Previous reading",b.previousReading],["Current reading",b.currentReading],["Usage (kWh)",b.usage],["Usage charge",formatMoney(b.usageCostPence)],["Standing charge",formatMoney(b.standingChargePence)],["Levy",formatMoney(b.levyPence)],["Brought forward",formatMoney(b.outstandingCarriedForwardPence)],["Bill total",formatMoney(b.roundedTotalPence)],["Paid",formatMoney(b.amountPaidPence)],["Remaining",formatMoney(b.remainingBalancePence)]].map(([k,v])=><div className="flex justify-between gap-3" key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl><p className="capitalize">{b.paidStatus.replaceAll("_"," ")}</p></section><a href={`/account/${params.token}?tab=queries`} className="underline">Raise a query about this bill</a></main>;
}
