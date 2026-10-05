
import { addDays, today } from "@/lib/rent-ledger/engine";
import { calendarDay } from "@/lib/rent-ledger/calendar";
import type { LedgerAccount } from "@/lib/rent-ledger/types";
import { formatMoney } from "@/lib/money";

const colours = { paid: "border-green-500/50 bg-green-500/15 text-green-200", partial: "border-amber-500/50 bg-amber-500/15 text-amber-200", overdue: "border-red-500/50 bg-red-500/15 text-red-200", unpaid: "border-slate-500/50 bg-slate-500/15 text-slate-200", unknown: "border-slateLine text-mutedText" };
export function RentCalendar({ account, month, basePath, onMonthChange }: { account: LedgerAccount; month?: string; basePath: string; onMonthChange?: (month:string)=>void }) {
  const now = today(); const year = Number(now.slice(0,4));
  const safe = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Math.abs(Number(month.slice(0,4)) - year) <= 10 ? month : now.slice(0,7);
  const first = `${safe}-01`; const d = new Date(`${first}T12:00:00Z`);
  const adjacent = (offset: number) => new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+offset,1,12)).toISOString().slice(0,7);
  const days = Number(addDays(`${adjacent(1)}-01`,-1).slice(-2)); const offset = (d.getUTCDay()+6)%7;
  const progress = calendarDay(account, now);
  const monthLink = (m: string) => `${basePath}${basePath.includes("?") ? "&" : "?"}month=${m}#calendar`;
  return <section className="space-y-4">
    <div><h3 className="font-bold">Current rent-period payment progress</h3>{progress.total ? <><p>{formatMoney(progress.paid)} allocated of {formatMoney(progress.total)} · {progress.percent}% · {progress.label}</p><progress aria-label="Current rent-period payment progress" className="mt-2 h-3 w-full accent-green-500" max={progress.total} value={progress.paid} /></> : <p>No calculated rent period covers today. Historical coverage is not inferred.</p>}</div>
    <div className="flex items-center justify-between gap-3">{onMonthChange?<button type="button" className="py-3 underline" onClick={()=>onMonthChange(adjacent(-1))}>← Previous</button>:<a className="py-3 underline" href={monthLink(adjacent(-1))}>← Previous</a>}<h2 id="calendar" className="text-lg font-black">{d.toLocaleDateString("en-GB",{month:"long",year:"numeric",timeZone:"UTC"})}</h2>{onMonthChange?<button type="button" className="py-3 underline" onClick={()=>onMonthChange(adjacent(1))}>Next →</button>:<a className="py-3 underline" href={monthLink(adjacent(1))}>Next →</a>}</div>
    <p className="text-sm">Green: fully paid · Amber: partially paid · Red: overdue unpaid · Grey: future unpaid / due today. Blank coverage is unknown.</p>
    <div className="grid grid-cols-7 gap-1 text-center">{["M","T","W","T","F","S","S"].map((day,i)=><span className="text-xs" key={i}>{day}</span>)}{Array.from({length:offset},(_,i)=><span key={`blank${i}`} />)}{Array.from({length:days},(_,i)=>{
      const day=addDays(first,i);const cell=calendarDay(account,day);
      return <div title={`${day}: ${cell.label}`} aria-label={`${day}: ${cell.label}`} key={day} className={`min-h-20 min-w-0 break-words rounded-lg border p-1 text-[10px] sm:p-2 sm:text-xs ${colours[cell.status]}`}><strong className="block text-sm">{i+1}</strong>{day===now&&<span className="block">Today</span>}<span>{cell.label}</span></div>;
    })}</div><p className="text-xs text-mutedText">Colours follow rent allocations and explicitly confirmed historical coverage. Service payments and payment dates alone do not establish rent coverage.</p>
  </section>;
}
