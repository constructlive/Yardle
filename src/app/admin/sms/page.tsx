import { DataTable, PageHeader, StatusPill, Td, Th } from "@/components/ui";
import { getAppData } from "@/lib/data";
import { getActiveSmsProviderName } from "@/lib/sms-logging";
import { TestSmsForm } from "./test-sms-form";

export const dynamic = "force-dynamic";

export default async function SmsPage() {
  const { smsLogs, units } = await getAppData();
  const recipients = units
    .filter((unit) => unit.tenantMobile)
    .map((unit) => ({ unitId: unit.id, mobile: unit.tenantMobile, label: `Unit ${unit.unitReference} - ${unit.tenantContactName || unit.tenantName || "No tenant assigned"}` }));
  const provider = await getActiveSmsProviderName();

  return (
    <>
      <PageHeader title="SMS logs" eyebrow="Provider Active" action={null} />
      <TestSmsForm provider={provider} recipients={recipients} />
      <DataTable>
        <thead>
          <tr>
            <Th>Unit</Th>
            <Th>Mobile</Th>
            <Th>Message</Th>
            <Th>Status</Th>
            <Th>Provider</Th>
            <Th>Reference</Th>
            <Th>Failure</Th>
            <Th>Sent</Th>
          </tr>
        </thead>
        <tbody>
          {smsLogs.length ? smsLogs.map((log) => {
            const unit = units.find((item) => item.id === log.unitId);
            const tone = log.status === "failed" ? "bad" : log.status === "queued" ? "warn" : "good";
            return (
              <tr key={log.id}>
                <Td strong>{unit?.unitReference ?? "-"}</Td>
                <Td>{log.mobile}</Td>
                <Td>{log.message}</Td>
                <Td><StatusPill tone={tone}>{log.status}</StatusPill></Td>
                <Td>{log.provider}</Td>
                <Td>{log.providerReference || "-"}</Td>
                <Td>{log.failureReason || "-"}</Td>
                <Td>{log.sentAt ? new Date(log.sentAt).toLocaleString("en-GB") : "-"}</Td>
              </tr>
            );
          }) : (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-sm font-bold text-muted">No SMS logs yet.</td></tr>
          )}
        </tbody>
      </DataTable>
    </>
  );
}