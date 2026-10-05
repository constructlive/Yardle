import { unstable_noStore as noStore } from "next/cache";
import { getAppData } from "../data";
import { catchUpAccount, mutateAccount, readAccounts } from "../rent-ledger/store";
import { authorisedBills, grantIsCurrent, resolvePrincipal } from "./policy";

export async function getTenantPortal(token: string) {
  noStore();
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return undefined;
  const data = await getAppData(); const accounts = await readAccounts();
  const principal = resolvePrincipal(token, accounts, data.units); if (!principal) return undefined;
  const account = await mutateAccount(principal.accountId, a => {
    if (!resolvePrincipal(token, accounts.map(other => other.id === a.id ? a : other), data.units)) return undefined;
    catchUpAccount(a); return structuredClone(a);
  });
  if (!account) return undefined;
  const bills = authorisedBills(account, data.units, data.bills).sort((a,b) => String(b.issuedAt).localeCompare(String(a.issuedAt)));
  const billIds = new Set(bills.map(b => b.id));
  const electricityUnits = data.units.filter(u => account.portalGrants?.some(g => grantIsCurrent(g,u)) && account.unitIds.includes(u.id));
  return { principal, account, bills, electricityUnits, electricityPayments: data.payments.filter(p => billIds.has(p.billId)), periods: data.billingPeriods.filter(p => bills.some(b => b.billingPeriodId === p.id)) };
}
