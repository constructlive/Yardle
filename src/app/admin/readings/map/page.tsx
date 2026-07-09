import { readFile } from "node:fs/promises";
import path from "node:path";
import { FocusedMeterReadingMap } from "@/components/focused-meter-reading-map";
import { getAppData } from "@/lib/data";

export default async function MapReadingPage() {
  const { billingPeriods, meterReadings, units } = await getAppData();
  const period = billingPeriods.find((item) => item.status === "draft") ?? billingPeriods[0];
  const svgMarkup = (await readFile(path.join(process.cwd(), "public", "yard-map.svg"), "utf8")).replace(/^<\?xml[^>]*>\s*/, "");
  return <FocusedMeterReadingMap svgMarkup={svgMarkup} units={units} period={period} initialReadings={meterReadings} />;
}