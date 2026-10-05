import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { audit, mutateAccount } from "@/lib/rent-ledger/store";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const secret = process.env.TWILIO_AUTH_TOKEN;
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/$/, "");
  if (!secret || !base.startsWith("https://")) return new NextResponse(null, { status: 503 });
  const params: Record<string,string> = {}; const form = await request.formData();
  for (const [key,value] of form) if (typeof value === "string") params[key] = value;
  const callbackUrl = `${base}/api/rent/sms-status${request.nextUrl.search}`;
  if (!twilio.validateRequest(secret, request.headers.get("x-twilio-signature") || "", callbackUrl, params)) return new NextResponse(null, { status: 403 });
  const accountId = request.nextUrl.searchParams.get("accountId"); const paymentId = request.nextUrl.searchParams.get("paymentId");
  const status = params.MessageStatus; const sid = params.MessageSid;
  if (!accountId || !paymentId || !sid || !["accepted","queued","sending","sent","delivered","undelivered","failed","read"].includes(status)) return new NextResponse(null, { status: 400 });
  try {
    await mutateAccount(accountId, a => {
      const p = a.payments.find(p => p.id === paymentId); const c = p?.confirmation;
      if (!c || (c.providerReference && c.providerReference !== sid)) throw new Error("Receipt does not match provider message.");
      if (["delivered","read"].includes(c.deliveryStatus || "") || c.deliveryStatus === status) return;
      c.providerReference = sid; c.deliveryStatus = status; c.updatedAt = new Date().toISOString();
      audit(a, "twilio-webhook", "sms_delivery_status", { paymentId, sid, status, errorCode: params.ErrorCode || undefined });
    });
    return new NextResponse(null, { status: 204 });
  } catch { return new NextResponse(null, { status: 404 }); }
}
