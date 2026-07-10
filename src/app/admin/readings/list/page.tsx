import { readFile } from "node:fs/promises";
import path from "node:path";
import { MeterReadingWorkspace } from "@/components/meter-reading-workspace";
import { PageHeader, PrimaryButton, SecondaryButton } from "@/components/ui";
import { getAppData } from "@/lib/data";
import { Check } from "lucide-react";

export const dynamic = "force-dynamic";

function EmptyState({ title, message, href, action }: { title: string; message: string; href?: string; action?: string }) {
  return <section className="rounded-2xl border border-slateLine bg-card p-8 text-center shadow-soft"><h2 className="text-2xl font-black text-ink">{title}</h2><p className="mx-auto mt-3 max-w-2xl font-bold text-mutedText">{message}</p>{href && action ? <div className="mt-5"><SecondaryButton href={href}>{action}</SecondaryButton></div> : null}</section>;
}

export default async function ReadingsPage() {
  const { billingPeriods, meterReadings, units, setupError } = await getAppData();
  const period = billingPeriods.find((item) => item.status === "draft") ?? billingPeriods[0];

  if (!period) {
    return <><PageHeader title="Meter readings" eyebrow="No active billing period" action={null} />{setupError ? <section className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-100 shadow-soft"><h2 className="text-xl font-black">Setup required</h2><p className="mt-2 text-sm font-bold text-red-200/80">{setupError}</p></section> : null}<EmptyState title="No active billing period" message="Create a billing period before entering readings." href="/admin/periods" action="Open billing periods" /></>;
  }

  if (units.length === 0) {
    return <><PageHeader title="Meter readings" eyebrow={period.name} action={null} /><EmptyState title="No units available" message="Add units before taking meter readings." href="/admin/units" action="Open units" /></>;
  }

  const periodReadings = meterReadings.filter((reading) => reading.billingPeriodId === period.id);
  const svgMarkup = (await readFile(path.join(process.cwd(), "public", "yard-map.svg"), "utf8")).replace(/^<\?xml[^>]*>\s*/, "");
  return <><PageHeader title="Meter readings" eyebrow={periodReadings.length ? period.name : `${period.name} - no readings yet`} action={<PrimaryButton href="/admin/bills/review"><Check className="h-5 w-5" />Review bills</PrimaryButton>} />{setupError ? <section className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-100 shadow-soft"><h2 className="text-xl font-black">Setup required</h2><p className="mt-2 text-sm font-bold text-red-200/80">{setupError}</p></section> : null}{periodReadings.length === 0 ? <section className="mb-6 rounded-2xl border border-slateLine bg-card p-5 shadow-soft"><h2 className="text-xl font-black text-ink">No readings yet</h2><p className="mt-2 font-bold text-mutedText">Select a unit below to enter the first reading for this period.</p></section> : null}<MeterReadingWorkspace svgMarkup={svgMarkup} units={units} period={period} initialReadings={meterReadings} initialMode="list" /></>;
}