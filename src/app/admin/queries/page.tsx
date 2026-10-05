import { requireAdminSession } from "@/lib/session";
import { readAccounts } from "@/lib/rent-ledger/store";
import { unreadCount } from "@/lib/tenant-portal/queries";
import { QueryConversation } from "@/components/tenant-portal/queries";
import { PageHeader } from "@/components/ui";
export const dynamic="force-dynamic";
export default async function Queries({searchParams}:{searchParams:{status?:string}}) {
  await requireAdminSession();const accounts=await readAccounts();const rows=accounts.flatMap(a=>(a.tenantQueries||[]).map(q=>({a,q})));
  return <div className="space-y-5"><PageHeader title="Tenant queries" eyebrow="Conversations stay in Yardle"/><p>{rows.reduce((n,{q})=>n+unreadCount(q,"admin"),0)} unread tenant messages</p><form><label>Filter by status<select className="mx-3 rounded-xl bg-card p-3" name="status" defaultValue={searchParams.status||"All"}>{["All","Open","In progress","Resolved"].map(s=><option key={s}>{s}</option>)}</select></label><button className="underline">Apply</button></form>{rows.filter(({q})=>!searchParams.status||searchParams.status==="All"||q.status===searchParams.status).sort((x,y)=>String(y.q.messages.at(-1)?.at).localeCompare(String(x.q.messages.at(-1)?.at))).map(({a,q})=><section key={q.id}><h2 className="mb-2 font-bold">{a.name}</h2><QueryConversation query={q} accountId={a.id}/></section>)}{!rows.length&&<p>No tenant queries yet.</p>}</div>;
}
