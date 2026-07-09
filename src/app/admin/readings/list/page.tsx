import { readFile } from "node:fs/promises";
import path from "node:path";
import { MeterReadingWorkspace } from "@/components/meter-reading-workspace";
import { PageHeader, PrimaryButton } from "@/components/ui";
import { getAppData } from "@/lib/data";
import { Check } from "lucide-react";

export default async function ReadingsPage() {
  const { billingPeriods, meterReadings, units } = await getAppData();
  const period = billingPeriods.find((item) => item.status === "draft") ?? billingPeriods[0];
  const svgMarkup = (await readFile(path.join(process.cwd(), "public", "yard-map.svg"), "utf8")).replace(/^<\?xml[^>]*>\s*/, "");
  return <><PageHeader title="Meter readings" eyebrow={period.name} action={<PrimaryButton href="/admin/bills/review"><Check className="h-5 w-5" />Review bills</PrimaryButton>} /><MeterReadingWorkspace svgMarkup={svgMarkup} units={units} period={period} initialReadings={meterReadings} initialMode="list" /></>;
}
