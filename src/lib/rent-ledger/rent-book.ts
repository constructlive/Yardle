import { chargeRemaining, chargesWithProjections, today } from "./engine";
import type { Charge, LedgerAccount } from "./types";

/** Keep supplements with their original period so a tick covers the whole liability. */
export function rentBookRows(account: LedgerAccount) {
  const charges = chargesWithProjections(account).filter(c => !c.cancelled && c.category === "rent" && c.coverageKnown && c.periodStart && c.periodEnd);
  const groups = new Map<string, Charge[]>();
  for (const charge of charges) {
    const id = charge.baseChargeId || charge.id;
    groups.set(id, [...(groups.get(id) || []), charge]);
  }
  return [...groups.entries()].map(([id, items]) => {
    const base = items.find(c => c.id === id) || items[0];
    const amount = items.reduce((sum, c) => sum + c.amountPence, 0);
    const remaining = items.reduce((sum, c) => sum + chargeRemaining(account, c), 0);
    const status = remaining === 0 ? (amount === 0 ? "No charge" : "Paid") : remaining < amount ? "Part paid" : base.dueDate < today() ? "Unpaid" : base.dueDate === today() ? "Due today" : "Upcoming";
    return { id, charges: items, from: base.periodStart!, to: base.periodEnd!, due: base.dueDate, name: base.description, amount, remaining, paid: amount - remaining, status };
  }).sort((a, b) => a.from.localeCompare(b.from) || a.name.localeCompare(b.name));
}
