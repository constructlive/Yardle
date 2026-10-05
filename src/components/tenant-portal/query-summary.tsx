import Link from "next/link";
import { readAccounts } from "@/lib/rent-ledger/store";
import { unreadCount } from "@/lib/tenant-portal/queries";
export async function QuerySummary(){const queries=(await readAccounts()).flatMap(a=>a.tenantQueries||[]);return <Link href="/admin/queries" className="my-4 block rounded-2xl border border-amber-500/30 bg-card p-4 font-bold">Tenant queries · {queries.reduce((n,q)=>n+unreadCount(q,"admin"),0)} unread messages · {queries.filter(q=>q.status!=="Resolved").length} open / in progress</Link>;}
