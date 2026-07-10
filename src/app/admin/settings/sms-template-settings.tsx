"use client";

import { useMemo, useState, useTransition } from "react";
import { Save } from "lucide-react";
import { saveSmsTemplateUpdate } from "@/lib/actions";
import { DEFAULT_SMS_TEMPLATES, SMS_TEMPLATE_PLACEHOLDERS, renderSmsTemplateBody } from "@/lib/sms-template-definitions";
import type { SmsTemplate } from "@/lib/types";

const exampleVariables = {
  estateName: "Yardle",
  tenantName: "Meadspeed",
  unitNumber: "2/3",
  billType: "1st July - 31st July 2026",
  amount: "£70.00",
  dueDate: "31/07/2026",
  paymentLink: "https://yardle.andersonyard.co.uk/bill/example"
};

export function SmsTemplateSettings({ templates }: { templates: SmsTemplate[] }) {
  const initialBodies = useMemo(() => Object.fromEntries(templates.map((template) => [template.templateKey, template.body])), [templates]);
  const [bodies, setBodies] = useState<Record<string, string>>(initialBodies);
  const [savingKey, setSavingKey] = useState<string>("");
  const [message, setMessage] = useState<{ ok: boolean; text: string; templateKey: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(templateKey: string) {
    setSavingKey(templateKey);
    setMessage(null);
    startTransition(async () => {
      const result = await saveSmsTemplateUpdate({ templateKey, body: bodies[templateKey] ?? "" });
      setMessage({ ok: result.ok, text: result.message, templateKey });
      setSavingKey("");
    });
  }

  return (
    <section className="mt-6 space-y-4 rounded-2xl border border-slateLine bg-card p-6 shadow-soft">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-estate-500">SMS</p>
          <h2 className="text-2xl font-black text-ink">SMS templates</h2>
          <p className="mt-1 text-sm font-bold text-secondaryText">Edit tenant message wording without changing the SMS provider or logs.</p>
        </div>
        <div className="rounded-xl border border-slateLine bg-sidebar px-3 py-2 text-xs font-black text-secondaryText">
          Placeholders: {SMS_TEMPLATE_PLACEHOLDERS.map((item) => `{{${item}}}`).join(" ")}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {templates.map((template) => {
          const definition = DEFAULT_SMS_TEMPLATES.find((item) => item.key === template.templateKey);
          const body = bodies[template.templateKey] ?? "";
          const preview = renderSmsTemplateBody(body, exampleVariables);
          const overOneSegment = preview.length > 160;
          const isSaving = isPending && savingKey === template.templateKey;
          return (
            <article key={template.templateKey} className="rounded-2xl border border-slateLine bg-sidebar p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-ink">{template.displayName}</h3>
                  <p className="mt-1 text-sm font-bold text-mutedText">{definition?.description}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[11px] font-black ${overOneSegment ? "bg-amber-500/15 text-amber-300" : "bg-estate-500/15 text-estate-500"}`}>
                  {preview.length} chars
                </span>
              </div>
              <textarea
                value={body}
                onChange={(event) => setBodies((current) => ({ ...current, [template.templateKey]: event.target.value }))}
                className="mt-4 min-h-32 w-full rounded-2xl border border-slateLine bg-[#111315] p-4 text-sm font-bold leading-6 text-ink outline-none transition placeholder:text-mutedText focus:border-estate-500"
              />
              <div className="mt-3 rounded-xl border border-slateLine bg-card p-3">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-mutedText">Preview</p>
                <p className="mt-1 text-sm font-bold text-secondaryText">{preview || "Preview will appear here."}</p>
                {overOneSegment ? <p className="mt-2 text-xs font-bold text-amber-300">This message is likely to use more than one SMS segment.</p> : null}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => save(template.templateKey)}
                  disabled={isSaving}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-estate-500 px-4 py-2 text-sm font-black text-[#07110b] shadow-glow transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
                >
                  <Save className="h-4 w-4" />{isSaving ? "Saving" : "Save template"}
                </button>
                {message?.templateKey === template.templateKey ? <span className={`text-sm font-bold ${message.ok ? "text-estate-500" : "text-red-300"}`}>{message.text}</span> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
