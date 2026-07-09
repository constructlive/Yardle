import { DataTable, PageHeader, PrimaryButton, StatusPill, Td, Th } from "@/components/ui";
import { saveSmsLog } from "@/lib/actions";
import { getAppData } from "@/lib/data";

export default async function SmsPage() {
  const { bills, smsLogs, units } = await getAppData();
  const firstBill = bills[0];
  const firstUnit = firstBill ? units.find((unit) => unit.id === firstBill.unitId) : undefined;
  return <><PageHeader title="SMS logs" eyebrow="Mock provider ready for Twilio, Vonage or Textlocal" action={null} /><form action={saveSmsLog} className="mb-6 grid gap-3 rounded-2xl border border-slateLine bg-card p-5 md:grid-cols-4"><input type="hidden" name="billId" value={firstBill?.id ?? ""} /><input type="hidden" name="unitId" value={firstUnit?.id ?? ""} /><input name="mobile" className="rounded-xl border border-slateLine bg-sidebar p-3 font-bold text-ink" defaultValue={firstUnit?.tenantMobile ?? ""} /><input name="message" className="rounded-xl border border-slateLine bg-sidebar p-3 font-bold text-ink md:col-span-2" defaultValue="Your Yardle electricity bill reminder is available." /><input type="hidden" name="status" value="simulated" /><input type="hidden" name="provider" value="mock" /><PrimaryButton>Send test SMS</PrimaryButton></form><DataTable><thead><tr><Th>Unit</Th><Th>Mobile</Th><Th>Message</Th><Th>Status</Th><Th>Provider</Th><Th>Sent</Th></tr></thead><tbody>{smsLogs.map((log) => { const unit = units.find((item) => item.id === log.unitId); return <tr key={log.id}><Td strong>{unit?.unitReference ?? "-"}</Td><Td>{log.mobile}</Td><Td>{log.message}</Td><Td><StatusPill tone="good">{log.status}</StatusPill></Td><Td>{log.provider}</Td><Td>{log.sentAt ? new Date(log.sentAt).toLocaleString("en-GB") : "-"}</Td></tr>; })}</tbody></DataTable></>;
}


