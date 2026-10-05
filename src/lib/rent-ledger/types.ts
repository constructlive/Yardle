export type Frequency = "weekly" | "monthly" | "manual";
export type Category = "rent" | "service" | "opening";
export type Rate = { effectiveDate: string; amountPence: number };
export type Schedule = {
  id: string; name: string; kind: "rent" | "service"; frequency: Frequency;
  startDate: string; endDate?: string; dueDay: number;
  timing: "advance" | "arrears"; partialRule: "daily" | "full";
  rates: Rate[]; enabled: boolean;
};
export type Charge = {
  id: string; accountId: string; sourceId: string; category: Category; description: string;
  periodStart?: string; periodEnd?: string; dueDate: string; amountPence: number;
  coverageKnown: boolean; legacyId?: string; cancelled?: boolean; baseChargeId?: string;
  calculation?: { from: string; to: string; ratePence: number; days: number; denominator: number }[];
};
export type Allocation = { chargeId: string; amountPence: number };
export type Receipt = {
  id: string; requestId: string; accountId: string; amountPence: number; receivedDate: string;
  method: string; reference: string; allocations: Allocation[]; recordedBy: string; createdAt: string;
  legacyId?: string; rateChargeId?: string; reversedAt?: string; reversedBy?: string; reversalReason?: string;
  confirmation?: { mobile: string; message: string; state: "prepared" | "sending" | "sent" | "simulated" | "failed" | "unknown"; providerReference?: string; error?: string; updatedAt?: string; deliveryStatus?: string };
};
export type Adjustment = { id: string; accountId: string; category: Category; amountPence: number; date: string; reason: string; actor: string };
export type AuditEvent = { id: string; at: string; actor: string; type: string; detail: unknown };
export type LedgerAccount = {
  id: string; name: string; contactName: string; mobile: string; email: string; unitIds: string[];
  schedules: Schedule[]; charges: Charge[]; payments: Receipt[]; adjustments: Adjustment[]; audit: AuditEvent[];
  version: number; state: "review" | "active" | "paused";
  migration: { importedAt: string; originalOpeningPence: number; suggestedOpeningPence: number; legacyThroughDate: string; warnings: string[]; snapshot: unknown };
  approval?: { actor: string; at: string; firstCoverageDate: string; confirmedOpeningPence: number; note: string };
  portalToken?: string; portalEnabled: boolean;
};
export type PaymentInput = { requestId: string; accountId: string; version: number; amountPence: number; receivedDate: string; method: string; reference: string; allocations: Allocation[] };
