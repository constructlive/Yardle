"use client";

import { useMemo, useState, useTransition } from "react";
import { BellRing, Send } from "lucide-react";
import { sendRentReminderSms } from "@/lib/actions";
import { renderSmsTemplateBody } from "@/lib/sms-template-definitions";

type RentReminderButtonProps = {
  unitId: string;
  unitReference: string;
  tenantName: string;
  mobile: string;
  totalOutstanding: string;
  defaultPeriodFrom: string;
  defaultPeriodTo: string;
  templateBody: string;
};

function formatDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function RentReminderButton({ unitId, unitReference, tenantName, mobile, totalOutstanding, defaultPeriodFrom, defaultPeriodTo, templateBody }: RentReminderButtonProps) {
  const [open, setOpen] = useState(false);
  const [periodFrom, setPeriodFrom] = useState(defaultPeriodFrom);
  const [periodTo, setPeriodTo] = useState(defaultPeriodTo);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const preview = useMemo(() => renderSmsTemplateBody(templateBody, {
    estateName: "Yardle",
    tenantName,
    unitNumber: unitReference,
    billType: "rent",
    amount: totalOutstanding,
    dueDate: formatDate(periodTo),
    periodFrom: formatDate(periodFrom),
    periodTo: formatDate(periodTo),
    paymentLink: ""
  }), [periodFrom, periodTo, templateBody, tenantName, totalOutstanding, unitReference]);

  function send() {
    setResult(null);
    startTransition(async () => {
      const response = await sendRentReminderSms({ unitId, periodFrom, periodTo });
      setResult(response);
      if (response.ok) setOpen(false);
    });
  }

  return <>
    <button
      type="button"
      onClick={() => { setResult(null); setOpen(true); }}
      disabled={!mobile}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slateLine bg-sidebar px-3 text-xs font-black text-secondaryText transition hover:bg-hover disabled:cursor-not-allowed disabled:opacity-45"
      title={mobile ? "Send rent reminder" : "No mobile number recorded"}
    >
      <BellRing className="h-4 w-4" />Rent SMS
    </button>
    {open ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slateLine bg-card shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slateLine p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-estate-500">Manual rent reminder</p>
            <h2 className="mt-1 text-2xl font-black text-ink">Send rent SMS</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slateLine bg-sidebar px-3 py-2 text-sm font-black text-secondaryText">Close</button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Unit" value={unitReference} />
            <Detail label="Tenant" value={tenantName || "Vacant"} />
            <Detail label="Mobile" value={mobile || "No mobile"} />
            <Detail label="Total outstanding" value={totalOutstanding} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-black text-secondaryText">From date<input type="date" value={periodFrom} onChange={(event) => setPeriodFrom(event.target.value)} className="h-12 rounded-xl border border-slateLine bg-sidebar px-3 font-black text-ink outline-none focus:border-estate-500" /></label>
            <label className="grid gap-2 text-sm font-black text-secondaryText">To date<input type="date" value={periodTo} onChange={(event) => setPeriodTo(event.target.value)} className="h-12 rounded-xl border border-slateLine bg-sidebar px-3 font-black text-ink outline-none focus:border-estate-500" /></label>
          </div>
          <div className="rounded-2xl border border-slateLine bg-sidebar p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-mutedText">Message preview</p>
            <p className="mt-2 text-base font-bold leading-7 text-ink">{preview}</p>
          </div>
          {result ? <div className={`rounded-xl border px-3 py-2 text-sm font-bold ${result.ok ? "border-estate-500/30 bg-estate-500/10 text-estate-500" : "border-red-500/40 bg-red-500/10 text-red-200"}`}>{result.message}</div> : null}
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-bold text-amber-100">This sends a real SMS when the active SMS provider is Twilio. It is manual only and will be recorded in SMS logs.</p>
        </div>
        <div className="flex shrink-0 justify-end gap-3 border-t border-slateLine bg-card/95 p-4 backdrop-blur">
          <button type="button" onClick={() => setOpen(false)} disabled={isPending} className="rounded-xl border border-slateLine bg-sidebar px-4 py-3 text-sm font-black text-secondaryText disabled:opacity-60">Cancel</button>
          <button type="button" onClick={send} disabled={isPending || !mobile} className="inline-flex items-center gap-2 rounded-xl bg-estate-500 px-4 py-3 text-sm font-black text-[#07110b] shadow-glow disabled:cursor-wait disabled:opacity-70"><Send className="h-4 w-4" />{isPending ? "Sending" : "Send SMS"}</button>
        </div>
      </div>
    </div> : null}
  </>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slateLine bg-sidebar p-3"><p className="text-[11px] font-black uppercase tracking-[0.12em] text-mutedText">{label}</p><p className="mt-1 text-base font-black text-ink">{value}</p></div>;
}
