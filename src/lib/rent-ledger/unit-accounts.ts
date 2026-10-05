import { randomUUID } from "node:crypto";
import { assertSchedule } from "./engine";
import { RentError } from "./errors";
import type { LedgerAccount, Schedule } from "./types";

export const tenantGroupId = (account: LedgerAccount) => account.tenantGroupId || account.id;
export function canSetUpUnitRent(account: LedgerAccount) {
  return !account.archivedAt && account.state === "review" && !account.approval && !account.charges.length && !account.payments.length && !account.adjustments.length && !account.portalEnabled && !account.portalScope;
}
export type UnitRentInput = { parentId: string; version: number; requestId: string; unitId: string; unitReference: string; sourceVersion?: number; confirmMove: boolean; schedule: Schedule };
/** Mutates only a transaction-local copy. Tenant grouping is administrative, never portal authorisation. */
export function prepareUnitRentAccount(accounts: LedgerAccount[], input: UnitRentInput, actor: string) {
  if (!/^[a-f0-9-]{36}$/.test(input.requestId)) throw new RentError("Invalid setup request. Refresh and try again.");
  const fingerprint = JSON.stringify([input.parentId,input.unitId,input.confirmMove,input.schedule]);
  for (const account of accounts) {
    const previous = account.audit.find(e => e.type === "unit_rent_setup" && (e.detail as {requestId?:string}).requestId === input.requestId);
    if (previous) {
      if ((previous.detail as {fingerprint:string}).fingerprint !== fingerprint) throw new RentError("This setup request was already saved with different values. Refresh before continuing.");
      return { accountId: account.id, changed: [] as LedgerAccount[] };
    }
  }
  if(accounts.some(a=>a.id===input.requestId))throw new RentError("Setup request conflicts with an existing account. Refresh and try again.");
  const parent=accounts.find(a=>!a.archivedAt&&a.id===input.parentId);
  if (!parent || parent.version!==input.version) throw new RentError("Tenant account changed. Refresh and review again.");
  if (tenantGroupId(parent)!==parent.id) throw new RentError("Open the tenant’s main row to add a unit account.");
  assertSchedule(input.schedule);
  if (input.schedule.kind!=="rent" || input.schedule.rates[0].amountPence<=0) throw new RentError("Enter the agreed rent for this unit.");
  const owners=accounts.filter(a=>!a.archivedAt&&a.unitIds.includes(input.unitId));
  if (owners.length>1) throw new RentError("This unit has conflicting assignments. Resolve them before setting up rent.");
  const owner=owners[0];
  if (owner && tenantGroupId(owner)!==parent.id) throw new RentError("This unit belongs to another tenant. Change its assignment first.");
  if (owner && owner.version!==input.sourceVersion) throw new RentError("The unit account changed. Refresh and review again.");
  if (owner && !canSetUpUnitRent(owner)) throw new RentError("This unit already has a confirmed rent account. Open that account to change its rent. Existing balances cannot be split automatically.");
  if (owner && owner.unitIds.length>1 && !input.confirmMove) throw new RentError("Confirm that this unit should have its own separate rent balance.");
  const reuse=owner?.unitIds.length===1 ? owner : !owner && parent.unitIds.length===0 && canSetUpUnitRent(parent) ? parent : undefined;
  const at=new Date().toISOString();const changed:LedgerAccount[]=[];
  const log=(a:LedgerAccount,type:string,detail:unknown)=>a.audit.push({id:randomUUID(),actor,at,type,detail});
  if (owner && owner!==reuse) {
    const before=[...owner.unitIds];owner.unitIds=owner.unitIds.filter(id=>id!==input.unitId);owner.version++;
    log(owner,"unit_membership_changed",{before,after:owner.unitIds,reason:"Administrator created a separate unit rent account. Existing history and draft schedules remain here."});changed.push(owner);
  }
  const account:LedgerAccount=reuse || {id:input.requestId,name:`${parent.name} — Unit ${input.unitReference}`,tenantGroupId:parent.id,contactName:parent.contactName,mobile:parent.mobile,email:parent.email,unitIds:[],state:"review",version:0,portalEnabled:false,schedules:[],charges:[],payments:[],adjustments:[],audit:[],migration:{importedAt:at,originalOpeningPence:0,suggestedOpeningPence:0,legacyThroughDate:"",warnings:[],snapshot:{}}};
  const before={unitIds:[...account.unitIds],schedules:structuredClone(account.schedules)};
  account.unitIds=[input.unitId];account.schedules=[structuredClone(input.schedule)];
  if(reuse)account.version++;
  log(account,"unit_rent_setup",{requestId:input.requestId,fingerprint,before,unitId:input.unitId,parentId:parent.id,openingBalanceConfirmed:false});
  log(account,"unit_membership_changed",{before:before.unitIds,after:account.unitIds,reason:"Administrator explicitly set up rent for this unit."});
  changed.push(account);
  return {accountId:account.id,changed};
}

export function prepareRentAccountGrouping(accounts:LedgerAccount[],parentId:string,parentVersion:number,sourceId:string,sourceVersion:number,actor:string){
  const parent=accounts.find(a=>a.id===parentId),source=accounts.find(a=>a.id===sourceId);
  if(!parent||!source||parent.archivedAt||source.archivedAt||parent.id===source.id)throw new RentError("Choose a different existing rent account.");
  if(parent.version!==parentVersion||source.version!==sourceVersion)throw new RentError("An account changed. Refresh and review the link again.");
  if(tenantGroupId(parent)!==parent.id||tenantGroupId(source)!==source.id||accounts.some(a=>!a.archivedAt&&a.id!==source.id&&tenantGroupId(a)===source.id))throw new RentError("This account already belongs to a tenant group. Open that tenant’s row instead.");
  source.tenantGroupId=parent.id;source.version++;parent.version++;
  const detail={tenantAccountId:parent.id,linkedAccountId:source.id,reason:"Administrator explicitly grouped these accounts for one tenant. Balances, allocations and portal permissions remain separate."};
  for(const a of [parent,source])a.audit.push({id:randomUUID(),actor,at:new Date().toISOString(),type:"tenant_rent_account_linked",detail});
  return [parent,source];
}
