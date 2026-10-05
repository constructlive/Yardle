import type { AppData } from "../data";
import { parseRentNotes } from "../rent";
import type { LedgerAccount, Schedule } from "./types";
import { today } from "./engine";

/** Originals are an immutable archive. Nothing is charged until a human confirms a cutover balance. */
export function migrationDrafts(data: AppData): LedgerAccount[] {
  const assigned = new Set(data.rentAccountUnits.map(l => l.unitId));
  const groups = new Map<string, { id: string; name: string; unitIds: string[]; explicit?: AppData["rentAccounts"][number] }>();
  for (const a of data.rentAccounts) groups.set(a.id, { id: a.id, name: a.name, unitIds: data.rentAccountUnits.filter(l => l.rentAccountId === a.id).map(l => l.unitId), explicit: a });
  for (const unit of data.units) {
    if (assigned.has(unit.id)) continue;
    const setting = data.rentSettings.find(s => s.unitId === unit.id);
    const history = data.rentCharges.some(c => c.unitId === unit.id) || data.rentPayments.some(p => p.unitId === unit.id);
    if (!setting && !history && unit.status !== "active") continue;
    const combined = parseRentNotes(setting?.notes).combinedAccount;
    // A matching explicit name absorbs the old note grouping; ambiguity is flagged below.
    const match = combined && data.rentAccounts.filter(a => a.name.trim().toLowerCase() === combined.toLowerCase());
    const key = match && match.length === 1 ? match[0].id : combined ? `notes:${combined.toLowerCase()}` : `unit:${unit.id}`;
    if (!groups.has(key)) groups.set(key, { id: key, name: combined || unit.tenantName || `Unit ${unit.unitReference}`, unitIds: [] });
    groups.get(key)!.unitIds.push(unit.id);
  }
  return [...groups.values()].map(g => {
    const units = data.units.filter(u => g.unitIds.includes(u.id));
    const settings = data.rentSettings.filter(s => g.unitIds.includes(s.unitId));
    const charges = data.rentCharges.filter(c => g.unitIds.includes(c.unitId));
    const payments = data.rentPayments.filter(p => g.unitIds.includes(p.unitId));
    const services = data.rentServices.filter(s => s.rentAccountId === g.id);
    const originalOpeningPence = settings.reduce((n, s) => n + s.openingBalancePence, 0) + (g.explicit?.openingBalancePence ?? 0);
    const opening = g.explicit ? g.explicit.openingBalancePence : settings.reduce((n, s) => n + s.openingBalancePence, 0);
    const suggestedOpeningPence = opening + charges.filter(c => c.status !== "cancelled").reduce((n, c) => n + c.amountPence, 0) - payments.filter(p => !p.reversedAt).reduce((n, p) => n + p.amountPence, 0);
    const convert = (id: string, name: string, kind: "rent" | "service", source: { frequency: string; amountPence: number; dueDayOfMonth?: number; enabled?: boolean; status?: string }): Schedule => ({ id, name, kind, frequency: source.frequency === "calendar_month" ? "monthly" : source.frequency === "manual" ? "manual" : "weekly", startDate: today(), dueDay: source.frequency === "calendar_month" ? source.dueDayOfMonth ?? 1 : 1, timing: "advance", partialRule: "daily", rates: [{ effectiveDate: today(), amountPence: source.amountPence }], enabled: source.enabled ?? source.status !== "inactive" });
    const schedules = g.explicit ? [convert(`rent:${g.id}`, "Rent", "rent", g.explicit)] : settings.map(s => convert(`rent:${s.id}`, `Rent — Unit ${units.find(u => u.id === s.unitId)?.unitReference ?? s.unitId}`, "rent", s));
    if (!schedules.length) schedules.push(convert(`rent:${g.id}`, "Rent", "rent", { frequency: "weekly_monday", amountPence: 0, enabled: true }));
    schedules.push(...services.map(s => convert(`service:${s.id}`, s.name, "service", s)));
    const warnings = ["Units from the old records are archived suggestions only. Assign units manually before enabling tenant access.","Existing figures are unconfirmed. Enter the authoritative balance through the day before new coverage starts. Archived entries are not added again.", "Historical allocation and paid-through dates are unknown; coverage begins at the approved cutover."];
    if (g.explicit && settings.some(s => s.openingBalancePence !== 0)) warnings.push("Both account and unit opening balances exist. Review the archive; do not add them together without reconciliation.");
    if (g.unitIds.length > 1) warnings.push("Confirm every linked unit belongs to this payer, and confirm the account contact details.");
    return { id: g.id, name: g.name, contactName: g.explicit?.contactName || units[0]?.tenantContactName || "", mobile: g.explicit?.mobile || units[0]?.tenantMobile || "", email: g.explicit?.email || units[0]?.tenantEmail || "", unitIds: [], schedules, charges: [], payments: [], adjustments: [], audit: [], version: 0, state: "review", portalEnabled: false, migration: { importedAt: new Date().toISOString(), originalOpeningPence, suggestedOpeningPence, legacyThroughDate: charges.map(c => c.dueDate).sort().at(-1) || "", warnings, snapshot: { account: g.explicit, units, settings, charges, payments, services } } };
  });
}
