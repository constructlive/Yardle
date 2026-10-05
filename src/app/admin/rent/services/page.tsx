import { accountPath } from "@/lib/rent-ledger/links";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { card } from "@/components/rent-ledger/views";
import { getLedgerAccounts } from "@/lib/rent-ledger/store";
export const dynamic = "force-dynamic";
export default async function Services() { const accounts = await getLedgerAccounts(); return <div className="space-y-4"><PageHeader title="Account services" eyebrow="Rent Management" /><p>Add and manage services inside their payer’s account. Each service has its own rate history, frequency, dates and partial-period rule.</p>{accounts.map(a => <section key={a.id} className={card}><Link className="font-bold text-amber-200" href={`${accountPath(a.id)}#schedules`}>{a.name}</Link>{a.schedules.filter(s => s.kind === "service").map(s => <p key={s.id}>{s.name} · {s.frequency} · {s.startDate} to {s.endDate || "ongoing"} · {s.enabled ? "enabled" : "disabled"}</p>)}</section>)}</div>; }
