import { formatMoney } from "./money";
import { getTenantBillUrl } from "./secure-link";
import type { Bill, BillingPeriod, SmsLog, Unit } from "./types";

export interface SmsProvider {
  name: string;
  send(input: { mobile: string; message: string }): Promise<{ status: SmsLog["status"]; providerReference: string }>;
}

export class MockSmsProvider implements SmsProvider {
  name = "mock";

  async send() {
    return {
      status: "simulated" as const,
      providerReference: `mock-${Date.now()}`
    };
  }
}

export function buildBillSms(period: BillingPeriod, bill: Bill, secureLink: string): string {
  return `Your Yardle electricity bill for ${period.name} is ready. Total due: ${formatMoney(bill.roundedTotalPence)}. View it here: ${secureLink}`;
}

export async function sendBillSms(provider: SmsProvider, period: BillingPeriod, bill: Bill, unit: Unit): Promise<SmsLog> {
  const message = buildBillSms(period, bill, getTenantBillUrl(unit.tenantAccessToken));
  const response = await provider.send({ mobile: unit.tenantMobile, message });
  return {
    id: `sms-${bill.id}-${Date.now()}`,
    billId: bill.id,
    unitId: unit.id,
    mobile: unit.tenantMobile,
    message,
    status: response.status,
    provider: provider.name,
    providerReference: response.providerReference,
    sentAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
}



