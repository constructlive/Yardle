"use server";
import { requireAdminSession } from "../session";
import { revalidatePath } from "next/cache";
import { readAccounts, mutateAccount, catchUpAccount } from "./store";
import { calculateReconciliation, applyReconciliation, type ReconcileInput } from "./reconciliation";
import { RentError, type ActionResult } from "./errors";
import { balances } from "./engine";

async function safely<T>(work:()=>Promise<T>):Promise<ActionResult<T>>{try{return{ok:true,value:await work()};}catch(e){if(e instanceof RentError)return{ok:false,error:e.message};console.error("Reconciliation failed",e instanceof Error?e.name:"unknown");return{ok:false,error:"Unable to complete reconciliation. Refresh and review before retrying."};}}
export async function previewCalendarReconciliation(input:ReconcileInput){return safely(async()=>{const user=await requireAdminSession();const account=(await readAccounts()).find(a=>a.id===input.accountId);if(!account)throw new RentError("Account not found.");catchUpAccount(account);const calculation=calculateReconciliation(account,input);const preview=structuredClone(account);const prepared={...input,opening:input.opening.trim() || (calculation.calculatedPence !== undefined ? (calculation.calculatedPence/100).toFixed(2) : ""),reason:input.reason.trim() || "Preview only; evidence must be entered before saving."};if(!prepared.opening)throw new RentError(calculation.warning);applyReconciliation(preview,prepared,user.userId);catchUpAccount(preview);return{calculation,account:preview,balances:balances(preview)};});}
export async function saveCalendarReconciliation(input:ReconcileInput){return safely(async()=>{const user=await requireAdminSession();if(!input.confirmed)throw new RentError("Review the preview and confirm before saving.");await mutateAccount(input.accountId,a=>{catchUpAccount(a);applyReconciliation(a,input,user.userId);catchUpAccount(a);});revalidatePath("/admin","layout");revalidatePath("/account","layout");});}
