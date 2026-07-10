"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { sendTestSms } from "@/lib/actions";

type State = {
  ok?: boolean;
  status?: string;
  provider?: string;
  providerReference?: string;
  failureReason?: string;
  recipient?: string;
};

type SmsRecipient = {
  unitId: string;
  label: string;
  mobile: string;
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button disabled={pending || disabled} className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl bg-estate-500 px-5 py-3 text-base font-bold text-[#07110b] shadow-glow transition duration-200 hover:-translate-y-0.5 hover:bg-estate-600 disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Sending..." : "Send SMS"}</button>;
}

export function TestSmsForm({ provider, recipients }: { provider: string; recipients: SmsRecipient[] }) {
  const [state, formAction] = useFormState(sendTestSms, {} as State);
  const [selectedUnitId, setSelectedUnitId] = useState(recipients[0]?.unitId ?? "");
  const selected = useMemo(() => recipients.find((recipient) => recipient.unitId === selectedUnitId), [recipients, selectedUnitId]);
  const isRealProvider = provider !== "mock";

  return (
    <form action={formAction} className="mb-6 grid gap-4 rounded-2xl border border-slateLine bg-card p-5 shadow-soft">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-black text-ink">Send SMS</h2>
          <p className="text-sm font-bold text-muted">Uses the active Yardle SMS provider and writes to the SMS log.</p>
        </div>
        <span className="w-fit rounded-full border border-slateLine bg-sidebar px-3 py-1 text-xs font-black uppercase tracking-wide text-muted">{provider}</span>
      </div>
      {isRealProvider ? <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm font-bold text-amber-100">Real SMS provider active. Sending this message will submit it to Twilio.</div> : null}
      <div className="grid gap-3 md:grid-cols-[minmax(220px,320px)_1fr_auto]">
        <label className="grid gap-2 text-sm font-black uppercase tracking-wide text-muted">
          Destination mobile
          <select name="unitId" value={selectedUnitId} onChange={(event) => setSelectedUnitId(event.target.value)} className="rounded-xl border border-slateLine bg-sidebar p-3 text-base font-bold text-ink outline-none focus:border-primary" required>
            {recipients.length ? recipients.map((recipient) => <option key={recipient.unitId} value={recipient.unitId}>{recipient.label}</option>) : <option value="">No saved mobile numbers</option>}
          </select>
        </label>
        <input type="hidden" name="mobile" value={selected?.mobile ?? ""} />
        <label className="grid gap-2 text-sm font-black uppercase tracking-wide text-muted">
          Message
          <input name="message" className="rounded-xl border border-slateLine bg-sidebar p-3 text-base font-bold text-ink outline-none focus:border-primary" defaultValue="Yardle SMS from the admin console." required />
        </label>
        <div className="flex items-end"><SubmitButton disabled={!selected} /></div>
      </div>
      {state.status ? <div className={`rounded-xl border p-3 text-sm font-bold ${state.ok ? "border-primary/40 bg-primary/10 text-green-100" : "border-red-500/40 bg-red-500/10 text-red-100"}`}>{state.ok ? `SMS ${state.status} via ${state.provider} to ${selected?.label ?? state.recipient}.` : `SMS failed via ${state.provider}: ${state.failureReason || "Check provider configuration."}`}</div> : null}
    </form>
  );
}
