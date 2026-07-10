import { randomUUID } from "node:crypto";
import { hasDatabaseUrl, query } from "./db";

export const PAYMENT_INSTRUCTIONS_SETTING_KEY = "payment.instructions";

export const DEFAULT_PAYMENT_INSTRUCTIONS = "Please pay by bank transfer using Unit {{unitNumber}} as your payment reference.\n\nFor payment queries contact {{estateName}}.";

type PaymentInstructionVariables = Partial<Record<"estateName" | "tenantName" | "unitNumber" | "amount" | "paymentLink", string | number | null | undefined>>;

let demoPaymentInstructions = DEFAULT_PAYMENT_INSTRUCTIONS;

function parseSettingValue(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "string" ? parsed : "";
  } catch {
    return value;
  }
}

export async function getPaymentInstructions() {
  if (!hasDatabaseUrl()) return demoPaymentInstructions;
  const result = await query<{ setting_value: string }>("select setting_value from settings where setting_key = ? limit 1", [PAYMENT_INSTRUCTIONS_SETTING_KEY]);
  const value = parseSettingValue(result.rows[0]?.setting_value);
  return value || DEFAULT_PAYMENT_INSTRUCTIONS;
}

export async function savePaymentInstructions(value: string) {
  const instructions = value.trim() || DEFAULT_PAYMENT_INSTRUCTIONS;
  if (!hasDatabaseUrl()) {
    demoPaymentInstructions = instructions;
    return;
  }
  await query(
    `insert into settings (id, setting_key, setting_value, created_at, updated_at)
     values (?, ?, ?, utc_timestamp(), utc_timestamp())
     on duplicate key update setting_value=values(setting_value), updated_at=utc_timestamp()`,
    [randomUUID(), PAYMENT_INSTRUCTIONS_SETTING_KEY, JSON.stringify(instructions)]
  );
}

export function renderPaymentInstructions(template: string, variables: PaymentInstructionVariables) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => {
    if (!["estateName", "tenantName", "unitNumber", "amount", "paymentLink"].includes(key)) return "";
    const value = variables[key as keyof PaymentInstructionVariables];
    return value === null || value === undefined ? "" : String(value);
  }).trim();
}
