import { randomUUID } from "node:crypto";
import { RentError } from "../rent-ledger/errors";
import type { LedgerAccount, TenantQuery } from "../rent-ledger/types";

export const queryStatuses = ["Open", "In progress", "Resolved"] as const;
export function unreadCount(query: TenantQuery, reader: "admin" | "tenant") {
  return query.messages.slice(reader === "admin" ? query.adminReadCount : query.tenantReadCount).filter(m => m.author !== reader).length;
}
export function validateMessage(text: string) {
  const clean = text.trim();
  if (!clean || clean.length > 4000) throw new RentError("Enter a message of 1–4,000 characters.");
  return clean;
}
export function addQuery(a: LedgerAccount, input: { requestId: string; subject: string; text: string; targetType: TenantQuery["targetType"]; targetId: string }, targets: { bills: string[]; payments: string[]; electricityPayments: string[] }) {
  if (!/^[a-f0-9-]{36}$/.test(input.requestId)) throw new RentError("Invalid request. Refresh and try again.");
  const existing = a.tenantQueries?.find(q => q.requestId === input.requestId); if (existing) return existing.id;
  const allowed = input.targetType === "bill" ? targets.bills : input.targetType === "payment" ? targets.payments : input.targetType === "electricity_payment" ? targets.electricityPayments : [];
  if (!allowed.includes(input.targetId)) throw new RentError("This record is not available on your account.");
  const subject = input.subject.trim(); if (!subject || subject.length > 120) throw new RentError("Enter a subject of 1–120 characters.");
  const text = validateMessage(input.text); const at = new Date().toISOString();
  const messagesToday = (a.tenantQueries || []).flatMap(q => q.messages).filter(m => m.author === "tenant" && m.at.slice(0,10) === at.slice(0,10));
  if (messagesToday.length >= 50) throw new RentError("Daily message limit reached. Please try again tomorrow.");
  const q: TenantQuery = { id: randomUUID(), requestId: input.requestId, subject, targetType: input.targetType, targetId: input.targetId, status: "Open", createdAt: at, messages: [{ id: randomUUID(), requestId: input.requestId, author: "tenant", text, at }], adminReadCount: 0, tenantReadCount: 1 };
  (a.tenantQueries ??= []).push(q); return q.id;
}
export function replyToQuery(q: TenantQuery, author: "tenant" | "admin", text: string, requestId: string) {
  if (!/^[a-f0-9-]{36}$/.test(requestId)) throw new RentError("Invalid request. Refresh and try again.");
  if (q.messages.some(m => m.requestId === requestId)) return;
  if (q.messages.length >= 500) throw new RentError("This conversation is full. Please start a new query.");
  q.messages.push({ id: randomUUID(), requestId, author, text: validateMessage(text), at: new Date().toISOString() });
  // Only explicit mark-read actions acknowledge messages; posting does not hide unseen replies.
  if (author === "tenant" && q.status === "Resolved") q.status = "Open";
}
