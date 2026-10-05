"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitTenantQuery, updateTenantQuery } from "@/lib/tenant-portal/actions";
import type { TenantQuery } from "@/lib/rent-ledger/types";
import { field, button, card } from "@/components/rent-ledger/views";

export function QueryComposer({ token, targets }: { token: string; targets: { value: string; label: string }[] }) {
  const router = useRouter(); const [busy,setBusy]=useState(false);const [message,setMessage]=useState(""); const [requestId,setRequestId]=useState("");
  return <form className={card} onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);const [targetType,...ids]=String(f.get("target")).split(":");const key=requestId||crypto.randomUUID();setRequestId(key);setBusy(true);try{const r=await submitTenantQuery(token,{requestId:key,subject:String(f.get("subject")),text:String(f.get("text")),targetType:targetType as TenantQuery["targetType"],targetId:ids.join(":")});setMessage(r.ok?"Query saved. Replies will appear here in Yardle.":r.error);if(r.ok){form.reset();setRequestId("");router.refresh();}}catch{setMessage("Unable to save. Refresh to check before retrying.");}finally{setBusy(false);}}}>
    <h2 className="text-xl font-bold">Raise a query</h2><p>Messages stay in Yardle. No email or external notification is sent.</p><label className="block">Bill or payment<select className={field} name="target" required>{targets.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label><label className="block">Subject<input className={field} name="subject" maxLength={120} required /></label><label className="block">Message<textarea className={field} name="text" rows={4} maxLength={4000} required /></label><button className={button} disabled={busy||!targets.length}>{busy?"Saving…":"Submit query"}</button>{!targets.length&&<p>No bills or payments are available to query yet.</p>}<p role="status">{message}</p>
  </form>;
}
export function QueryConversation({ query:q, token, accountId }: { query: TenantQuery; token?: string; accountId?: string }) {
  const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [key,setKey]=useState("");
  const admin=token===undefined;const unread=q.messages.slice(admin?q.adminReadCount:q.tenantReadCount).filter(m=>m.author!==(admin?"admin":"tenant")).length;
  async function update(input: Partial<Parameters<typeof updateTenantQuery>[0]>) {setBusy(true);setError("");try{const result=await updateTenantQuery({token,accountId,queryId:q.id,operation:"read",...input});if(!result.ok){setError(result.error);return false;}router.refresh();return true;}catch{setError("Unable to save. Refresh and check before retrying.");return false;}finally{setBusy(false);}}
  return <details className={card}><summary className="cursor-pointer py-2 font-bold">{q.subject} · {q.status}{unread?` · ${unread} unread`:""}</summary><p className="break-all text-xs">Regarding {q.targetType.replaceAll("_"," ")} · {q.targetId}</p>{q.messages.map(m=><article className={`rounded-xl p-3 ${m.author==="admin"?"bg-amber-500/10":"bg-sidebar"}`} key={m.id}><p className="text-xs text-mutedText">{m.author==="admin"?"Yardle office":"Tenant"} · {new Date(m.at).toLocaleString("en-GB")}</p><p className="whitespace-pre-wrap break-words">{m.text}</p></article>)}{unread>0&&<button disabled={busy} className={button} onClick={()=>update({operation:"read",readCount:q.messages.length})}>Mark {unread} messages read</button>}
    <form onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);const id=key||crypto.randomUUID();setKey(id);if(await update({operation:"reply",text:String(f.get("text")),requestId:id})){form.reset();setKey("");}}}><label>Reply<textarea name="text" className={field} maxLength={4000} required rows={3}/></label><button className={button} disabled={busy}>Post reply in Yardle</button></form>
    {admin&&<label>Status<select className={field} disabled={busy} value={q.status} onChange={e=>update({operation:"status",status:e.target.value})}>{["Open","In progress","Resolved"].map(s=><option key={s}>{s}</option>)}</select></label>}<p role="alert" className="text-red-300">{error}</p>
  </details>;
}
