import { formatMoney } from "./money";
import { getTenantBillUrl } from "./secure-link";
import type { Bill, BillingPeriod, SmsLog, Unit } from "./types";

export interface SmsProvider {
  name: string;
  send(input: { mobile: string; message: string }): Promise<SmsSendResult>;
}

export interface SmsSendResult {
  recipient: string;
  status: SmsLog["status"];
  providerReference: string;
  failureReason?: string;
}

export class MockSmsProvider implements SmsProvider {
  name = "mock";

  async send(input: { mobile: string; message: string }): Promise<SmsSendResult> {
    return {
      recipient: input.mobile.trim() || "No mobile",
      status: "simulated",
      providerReference: `mock-${Date.now()}`
    };
  }
}

export class TwilioSmsProvider implements SmsProvider {
  name = "twilio";

  async send(input: { mobile: string; message: string }): Promise<SmsSendResult> {
    const configError = validateTwilioConfig();
    if (configError) {
      return {
        recipient: input.mobile.trim(),
        status: "failed",
        providerReference: "",
        failureReason: configError
      };
    }

    let recipient: string;
    try {
      recipient = normaliseUkMobile(input.mobile);
    } catch (error) {
      return {
        recipient: input.mobile.trim(),
        status: "failed",
        providerReference: "",
        failureReason: safeSmsErrorMessage(error)
      };
    }

    try {
      const { default: twilio } = await import("twilio");
      const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      const message = await client.messages.create({
        to: recipient,
        from: process.env.TWILIO_FROM!,
        body: input.message
      });

      return {
        recipient,
        status: twilioSubmissionStatus(message.status),
        providerReference: message.sid
      };
    } catch (error) {
      return {
        recipient,
        status: "failed",
        providerReference: "",
        failureReason: safeSmsErrorMessage(error)
      };
    }
  }
}

export function getSmsProvider(): SmsProvider {
  const provider = (process.env.SMS_PROVIDER || "mock").toLowerCase();
  if (provider === "twilio") {
    return new TwilioSmsProvider();
  }
  return new MockSmsProvider();
}

export function normaliseUkMobile(value: string): string {
  const stripped = value.replace(/[\s()-]/g, "").trim();
  if (!stripped) {
    throw new Error("Mobile number is required.");
  }

  const normalised = stripped.startsWith("+")
    ? stripped
    : stripped.startsWith("0")
      ? `+44${stripped.slice(1)}`
      : stripped.startsWith("44")
        ? `+${stripped}`
        : stripped;

  if (!/^\+[1-9]\d{7,14}$/.test(normalised)) {
    throw new Error("Mobile number is invalid.");
  }

  return normalised;
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
    mobile: response.recipient,
    message,
    status: response.status,
    provider: provider.name,
    providerReference: response.providerReference,
    failureReason: response.failureReason,
    sentAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
}

function validateTwilioConfig() {
  const missing = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM"].filter((name) => !process.env[name]);
  if (!missing.length) {
    return "";
  }
  return `Twilio is not configured. Missing: ${missing.join(", ")}.`;
}

function twilioSubmissionStatus(status: string | null): SmsLog["status"] {
  if (status === "sent" || status === "delivered") {
    return "sent";
  }
  if (status === "failed" || status === "undelivered") {
    return "failed";
  }
  return "queued";
}

function safeSmsErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    if (/account|token|credential|auth/i.test(error.message)) {
      return "SMS provider rejected the request. Check the Twilio configuration.";
    }
    return error.message.slice(0, 240);
  }
  return "SMS provider request failed.";
}