import { ensureSeeded, hasDatabaseUrl, query, type DbClient } from "./db";
import { DEFAULT_SMS_TEMPLATES, getDefaultSmsTemplate, renderSmsTemplateBody, type SmsTemplateKey, type SmsTemplateVariables } from "./sms-template-definitions";
import type { SmsTemplate } from "./types";

function mapSmsTemplate(row: Record<string, unknown>): SmsTemplate {
  return {
    id: String(row.id),
    templateKey: String(row.template_key) as SmsTemplateKey,
    displayName: String(row.display_name),
    body: String(row.body ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? "")
  };
}

function defaultTemplates(): SmsTemplate[] {
  const now = new Date().toISOString();
  return DEFAULT_SMS_TEMPLATES.map((template) => ({
    id: template.id,
    templateKey: template.key,
    displayName: template.displayName,
    body: template.body,
    createdAt: now,
    updatedAt: now
  }));
}

export async function getSmsTemplates(): Promise<SmsTemplate[]> {
  if (!hasDatabaseUrl()) return defaultTemplates();
  await ensureSeeded();
  const result = await query("select * from sms_templates order by template_key");
  const rows = result.rows.map(mapSmsTemplate);
  return DEFAULT_SMS_TEMPLATES.map((definition) => rows.find((row) => row.templateKey === definition.key) ?? {
    id: definition.id,
    templateKey: definition.key,
    displayName: definition.displayName,
    body: definition.body,
    createdAt: "",
    updatedAt: ""
  });
}

export async function saveSmsTemplate(input: { templateKey: string; body: string }) {
  const definition = DEFAULT_SMS_TEMPLATES.find((template) => template.key === input.templateKey);
  if (!definition) return { ok: false, message: "Unknown SMS template." };
  const body = input.body.replace(/\r\n/g, "\n").trim();
  if (!body) return { ok: false, message: "Template message cannot be empty." };
  if (!hasDatabaseUrl()) return { ok: true, message: "Template saved for this Demo Mode session only." };
  await ensureSeeded();
  await query(
    `insert into sms_templates (id, template_key, display_name, body) values (?,?,?,?)
     on duplicate key update display_name=values(display_name), body=values(body), updated_at=utc_timestamp()`,
    [definition.id, definition.key, definition.displayName, body]
  );
  return { ok: true, message: `${definition.displayName} template saved.` };
}

export async function renderSmsTemplate(templateKey: SmsTemplateKey, variables: SmsTemplateVariables, client?: DbClient) {
  let body = getDefaultSmsTemplate(templateKey).body;
  if (hasDatabaseUrl()) {
    try {
      await ensureSeeded();
      const result = client
        ? await client.query("select body from sms_templates where template_key = ? limit 1", [templateKey])
        : await query("select body from sms_templates where template_key = ? limit 1", [templateKey]);
      if (result.rows[0]?.body) body = String(result.rows[0].body);
    } catch {
      body = getDefaultSmsTemplate(templateKey).body;
    }
  }
  return renderSmsTemplateBody(body, variables);
}
