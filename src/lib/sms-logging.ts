import { randomUUID } from "node:crypto";
import { addDemoSmsLog } from "./demo-store";
import { type DbClient, hasDatabaseUrl, query } from "./db";
import { getSmsProvider } from "./sms";
import type { SmsLog } from "./types";

type SendAndLogSmsInput = {
  billId?: string;
  unitId?: string;
  mobile: string;
  message: string;
};

export async function getActiveSmsProviderName(client?: DbClient) {
  const envProvider = (process.env.SMS_PROVIDER || "").trim().toLowerCase();
  const runner = client ?? { query };

  if (hasDatabaseUrl()) {
    try {
      const result = await runner.query<{ setting_value: string }>("select setting_value from settings where setting_key = ? limit 1", ["sms.provider"]);
      const raw = result.rows[0]?.setting_value;
      const settingProvider = raw ? String(JSON.parse(raw)).trim().toLowerCase() : "";
      if (settingProvider === "twilio" || settingProvider === "mock") return settingProvider;
    } catch {
      // Fall back to environment if settings are not available yet.
    }
  }

  return envProvider || "mock";
}

export async function sendAndLogSms(input: SendAndLogSmsInput, client?: DbClient): Promise<SmsLog> {
  const providerName = await getActiveSmsProviderName(client);
  const provider = getSmsProvider(providerName);
  const response = await provider.send({ mobile: input.mobile, message: input.message });
  const now = new Date().toISOString();
  const log: SmsLog = {
    id: randomUUID(),
    billId: input.billId ?? "",
    unitId: input.unitId ?? "",
    mobile: response.recipient || input.mobile || "No mobile",
    message: input.message,
    status: response.status,
    provider: provider.name,
    providerReference: response.providerReference,
    failureReason: response.failureReason,
    sentAt: now,
    createdAt: now
  };

  if (!hasDatabaseUrl() && !client) {
    addDemoSmsLog({
      billId: input.billId,
      unitId: input.unitId,
      mobile: log.mobile,
      message: log.message,
      status: log.status,
      provider: log.provider,
      providerReference: log.providerReference,
      failureReason: log.failureReason
    });
    return log;
  }

  await insertSmsLog(log, client);
  return log;
}

export async function insertSmsLog(log: SmsLog, client?: DbClient) {
  const runner = client ?? { query };
  await runner.query(
    `insert into sms_logs (id, bill_id, unit_id, mobile, message, status, provider, provider_reference, failure_reason, sent_at)
     values (?,?,?,?,?,?,?,?,?,utc_timestamp())`,
    [
      log.id,
      log.billId || null,
      log.unitId || null,
      log.mobile,
      log.message,
      log.status,
      log.provider,
      log.providerReference || null,
      log.failureReason || null
    ]
  );
}