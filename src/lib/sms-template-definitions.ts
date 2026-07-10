export const SMS_TEMPLATE_PLACEHOLDERS = [
  "estateName",
  "tenantName",
  "unitNumber",
  "billType",
  "amount",
  "dueDate",
  "paymentLink"
] as const;

export type SmsTemplatePlaceholder = (typeof SMS_TEMPLATE_PLACEHOLDERS)[number];

export type SmsTemplateKey =
  | "welcome"
  | "bill_generated"
  | "payment_reminder"
  | "overdue_reminder"
  | "payment_received"
  | "meter_reading_reminder";

export interface SmsTemplateDefinition {
  id: string;
  key: SmsTemplateKey;
  displayName: string;
  description: string;
  body: string;
}

export const DEFAULT_SMS_TEMPLATES: SmsTemplateDefinition[] = [
  {
    id: "00000000-0000-4000-9000-000000000001",
    key: "welcome",
    displayName: "Welcome / Online Bill Access",
    description: "Sent when sharing a tenant's secure bill link.",
    body: "Welcome to {{estateName}} online bill access for Unit {{unitNumber}}. View your bills here: {{paymentLink}}"
  },
  {
    id: "00000000-0000-4000-9000-000000000002",
    key: "bill_generated",
    displayName: "Bill Generated",
    description: "Sent when a bill is issued or a secure bill link is sent.",
    body: "Your Yardle electricity bill for {{billType}} is ready. Total due: {{amount}}. View it here: {{paymentLink}}"
  },
  {
    id: "00000000-0000-4000-9000-000000000003",
    key: "payment_reminder",
    displayName: "Payment Reminder",
    description: "Sent as a reminder for unpaid or part-paid bills.",
    body: "Reminder: Unit {{unitNumber}} has {{amount}} outstanding for {{billType}}. View your bill here: {{paymentLink}}"
  },
  {
    id: "00000000-0000-4000-9000-000000000004",
    key: "overdue_reminder",
    displayName: "Overdue Reminder",
    description: "Sent when an unpaid balance needs stronger follow-up.",
    body: "Overdue reminder: Unit {{unitNumber}} has {{amount}} outstanding. Please arrange payment as soon as possible. {{paymentLink}}"
  },
  {
    id: "00000000-0000-4000-9000-000000000005",
    key: "payment_received",
    displayName: "Payment Received",
    description: "Sent when a payment receipt SMS is enabled in a workflow.",
    body: "Thank you. We have received {{amount}} for Unit {{unitNumber}} at {{estateName}}."
  },
  {
    id: "00000000-0000-4000-9000-000000000006",
    key: "meter_reading_reminder",
    displayName: "Meter Reading Reminder",
    description: "Sent when a tenant needs to provide or confirm a reading.",
    body: "Reminder: please provide your meter reading for Unit {{unitNumber}} at {{estateName}}. {{paymentLink}}"
  }
];

export type SmsTemplateVariables = Partial<Record<SmsTemplatePlaceholder, string | number | null | undefined>>;

export function renderSmsTemplateBody(body: string, variables: SmsTemplateVariables) {
  return body
    .replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => {
      if (!SMS_TEMPLATE_PLACEHOLDERS.includes(key as SmsTemplatePlaceholder)) return "";
      const value = variables[key as SmsTemplatePlaceholder];
      return value === null || value === undefined ? "" : String(value);
    })
    .replace(/\s+/g, " ")
    .trim();
}

export function getDefaultSmsTemplate(key: SmsTemplateKey) {
  return DEFAULT_SMS_TEMPLATES.find((template) => template.key === key) ?? DEFAULT_SMS_TEMPLATES[0];
}
