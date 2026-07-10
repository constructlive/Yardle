"use client";

import { regenerateTenantBillLink, sendTenantBillLinkSms } from "@/lib/actions";
import { Copy, Mail, MessageSquareText, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";

const buttonClass = "tap-target inline-flex items-center gap-2 rounded-2xl border border-slateLine bg-sidebar px-5 py-3 font-black text-ink transition hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40";

export function SecureBillLinkControls({ unitId, secureUrl, enabled, email }: { unitId: string; secureUrl: string; enabled: boolean; email: string }) {
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const emailHref = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("Your Yardle online bill access")}&body=${encodeURIComponent(`You can view your Yardle bills securely here: ${secureUrl}`)}`;

  async function copyLink() {
    await navigator.clipboard.writeText(secureUrl);
    setCopied(true);
    setMessage({ ok: true, text: "Secure bill link copied." });
    window.setTimeout(() => setCopied(false), 1800);
  }

  function sendSms() {
    setMessage(null);
    startTransition(async () => {
      const result = await sendTenantBillLinkSms(unitId);
      setMessage({ ok: result.ok, text: result.message });
    });
  }

  return <div className="grid gap-3">
    <div className="flex min-w-0 gap-2 rounded-2xl border border-slateLine bg-[#121416] p-2"><input readOnly value={secureUrl} aria-label="Secure bill link" className="min-w-0 flex-1 bg-transparent px-3 text-sm font-bold text-secondaryText outline-none" /><button type="button" onClick={copyLink} disabled={!enabled} className={buttonClass}><Copy className="h-5 w-5" />{copied ? "Copied" : "Copy link"}</button></div>
    <div className="flex flex-wrap gap-3">
      <button type="submit" formAction={regenerateTenantBillLink} className={buttonClass}><RotateCcw className="h-5 w-5" />Regenerate link</button>
      <button type="button" onClick={sendSms} disabled={!enabled || isPending} className={buttonClass}><MessageSquareText className="h-5 w-5" />{isPending ? "Sending" : "Send by SMS"}</button>
      <a href={email ? emailHref : undefined} aria-disabled={!enabled || !email} className={`${buttonClass} ${!enabled || !email ? "pointer-events-none opacity-40" : ""}`}><Mail className="h-5 w-5" />Send by email</a>
    </div>
    {message ? <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${message.ok ? "border-estate-500/30 bg-estate-500/10 text-estate-500" : "border-red-500/40 bg-red-500/10 text-red-200"}`}>{message.text}</div> : null}
    <p className="text-sm text-mutedText">Regenerating immediately invalidates the previous link.</p>
  </div>;
}