"use server";
import { requireAdminSession } from "../session";
import { revalidatePath } from "next/cache";
import { readAccounts, mutateAccount, catchUpAccount } from "./store";
import { calculateReconciliation, applyReconciliation, type ReconcileInput } from "./reconciliation";
import { RentError, RentFieldError, type ActionResult } from "./errors";
import { balances, today } from "./engine";

async function safely<T>(work:()=>Promise<T>):Promise<ActionResult<T>> {
  try { return {ok:true,value:await work()}; }
  catch(e) {
    if(e && typeof e === "object" && "digest" in e && String(e.digest).startsWith("NEXT_REDIRECT")) throw e;
    if(e instanceof RentError) return {ok:false,error:e.message,...(e instanceof RentFieldError?{fieldErrors:{[e.field]:e.message}}:{})};
    console.error("Reconciliation failed",e instanceof Error?e.name:"unknown");
    return {ok:false,error:"Unable to complete reconciliation. Refresh and review before retrying."};
  }
}
export async function previewCalendarReconciliation(input:ReconcileInput) {
  return safely(async()=>{
    const user=await requireAdminSession();
    const account=(await readAccounts()).find(a=>a.id===input.accountId);
    if(!account)throw new RentError("Account not found.");
    catchUpAccount(account);
    const calculation=calculateReconciliation(account,input), preview=structuredClone(account);
    applyReconciliation(preview,{...input,reason:input.reason.trim() || "Preview only; enter evidence for a manual balance before saving."},user.userId);
    catchUpAccount(preview,calculation.calculationDate);
    return {calculation,account:preview,balances:balances(preview,calculation.calculationDate)};
  });
}
export async function saveCalendarReconciliation(input:ReconcileInput) {
  return safely(async()=>{
    const user=await requireAdminSession();
    if(!input.confirmed)throw new RentFieldError("confirmed","Review the preview and tick the confirmation before saving.");
    await mutateAccount(input.accountId,a=>{
      if(!a.reconciliationRequests?.includes(input.requestId) && input.calculationDate && input.calculationDate!==today()) throw new RentFieldError("calculationDate","The calculation date has changed. Refresh and preview today’s balance before saving.");
      catchUpAccount(a); applyReconciliation(a,input,user.userId); catchUpAccount(a);
    });
    revalidatePath("/admin","layout");revalidatePath("/account","layout");
  });
}
