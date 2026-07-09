"use client";

import { regenerateTenantBillLink, sendTenantBillLinkSms } from "@/lib/actions";
import { Copy, Mail, MessageSquareText, RotateCcw } from "lucide-react";
import { useState } from "react";

const buttonClass = "tap-target inline-flex items-center gap-2 rounded-2xl border border-slateLine bg-sidebar px-5 py-3 font-black text-ink transition hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40";

export function SecureBillLinkControls({ secureUrl, enabled, email }: { secureUrl: string; enabled: boolean; email: string }) {
  const [copied, setCopied] = useState(false);
  const emailHref = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("Your Yardle electricity bill")}&body=${encodeURIComponent(`Your Yardle electricity bill is ready. View it securely here: ${secureUrl}`)}`;
  async function copyLink() {
    await navigator.clipboard.writeText(secureUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return <div className="grid gap-3">
    <div className="flex min-w-0 gap-2 rounded-2xl border border-slateLine bg-[#121416] p-2"><input readOnly value={secureUrl} aria-label="Secure bill link" className="min-w-0 flex-1 bg-transparent px-3 text-sm font-bold text-secondaryText outline-none" /><button type="button" onClick={copyLink} disabled={!enabled} className={buttonClass}><Copy className="h-5 w-5" />{copied ? "Copied" : "Copy link"}</button></div>
    <div className="flex flex-wrap gap-3">
      <button type="submit" formAction={regenerateTenantBillLink} className={buttonClass}><RotateCcw className="h-5 w-5" />Regenerate link</button>
      <button type="submit" formAction={sendTenantBillLinkSms} disabled={!enabled} className={buttonClass}><MessageSquareText className="h-5 w-5" />Send by SMS</button>
      <a href={email ? emailHref : undefined} aria-disabled={!enabled || !email} className={`${buttonClass} ${!enabled || !email ? "pointer-events-none opacity-40" : ""}`}><Mail className="h-5 w-5" />Send by email</a>
    </div>
    <p className="text-sm text-mutedText">Regenerating immediately invalidates the previous link.</p>
  </div>;
}



