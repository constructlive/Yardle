import Link from "next/link";
import { addDays, chargesWithProjections, rentCoverage, today } from "@/lib/rent-ledger/engine";
import type { LedgerAccount } from "@/lib/rent-ledger/types";
import { formatMoney } from "@/lib/money";

export function RentCalendar({ account, month, basePath }: { account: LedgerAccount; month?: string; basePath: string }) {
  const currentYear = Number(today().slice(0,4));
  const safeMonth = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Math.abs(Number(month.slice(0,4)) - currentYear) <= 2 ? month : today().slice(0,7);
  const first = `${safeMonth}-01`; const firstDate = new Date(`${first}T12:00:00Z`);
  const nextMonth = new Date(Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth()+1, 1,12)).toISOString().slice(0,7);
  const previousMonth = new Date(Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth()-1, 1,12)).toISOString().slice(0,7);
  const last = addDays(`${nextMonth}-01`,-1); const totalDays = Number(last.slice(-2)); const offset = (firstDate.getUTCDay()+6)%7;
  const charges = chargesWithProjections(account,last).filter(c=>!c.cancelled); const coverage = rentCoverage(account);
  const label = firstDate.toLocaleDateString("en-GB",{month:"long",year:"numeric",timeZone:"UTC"});
  return <section className="space-y-3"><div className="flex items-center justify-between gap-3"><Link className="underline" href={`${basePath}?month=${previousMonth}#calendar`}>Previous month</Link><h2 id="calendar" className="text-xl font-black">{label}</h2><Link className="underline" href={`${basePath}?month=${nextMonth}#calendar`}>Next month</Link></div><p className="text-sm text-mutedText">Green days belong to fully allocated rent periods. Receipts and service charges are listed separately. Future due dates are upcoming, not current arrears.</p><div className="overflow-x-auto"><div className="grid min-w-[42rem] grid-cols-7 gap-1">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=><div className="p-2 text-center text-xs font-bold" key={d}>{d}</div>)}{Array.from({length:offset},(_,i)=><div key={`blank-${i}`} />)}{Array.from({length:totalDays},(_,i)=>{
    const day = addDays(first,i); const due = charges.filter(c=>c.dueDate===day); const received = account.payments.filter(p=>!p.reversedAt&&p.receivedDate===day);
    const covered = coverage.fullyCovered.some(c=>c.periodStart!<=day&&c.periodEnd!>=day);
    return <div key={day} className={`min-h-28 rounded-lg border p-2 text-xs ${covered ? "border-green-500/40 bg-green-500/10" : "border-slateLine bg-sidebar"}`}><p className="mb-2 font-bold">{i+1}{day===today()?" · Today":""}</p>{due.map(c=><p key={c.id} className={c.dueDate>today()?"text-amber-200":"text-secondaryText"}>{c.category==="service"?"Service":"Rent"} due {formatMoney(c.amountPence)}</p>)}{received.map(p=><p key={p.id} className="text-green-300">{p.legacyId?"Credit":"Received"} {formatMoney(p.amountPence)}</p>)}{covered&&<p className="mt-1 text-green-300">Rent covered</p>}</div>;
  })}</div></div></section>;
}
