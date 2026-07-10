import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { FocusedMeterReadingMap } from "@/components/focused-meter-reading-map";
import { getAppData } from "@/lib/data";
import { DoorOpen } from "lucide-react";

export const dynamic = "force-dynamic";

function FocusedEmptyState({ title, message, href, action }: { title: string; message: string; href: string; action: string }) {
  return <main className="grid min-h-[100dvh] place-items-center bg-[#0b0d0f] p-6 text-ink"><section className="w-full max-w-xl rounded-2xl border border-slateLine bg-card p-8 text-center shadow-soft"><BrandLogo className="mx-auto h-16 w-48 rounded-2xl" /><h1 className="mt-8 text-3xl font-black text-white">{title}</h1><p className="mt-3 font-bold text-mutedText">{message}</p><Link href={href} className="tap-target mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-estate-500 px-5 py-3 font-black text-[#07110b]"><DoorOpen className="h-5 w-5" />{action}</Link></section></main>;
}

export default async function MapReadingPage() {
  const { billingPeriods, meterReadings, units, setupError } = await getAppData();
  const period = billingPeriods.find((item) => item.status === "draft") ?? billingPeriods[0];

  if (!period) {
    return <FocusedEmptyState title={setupError ? "Setup required" : "No active billing period"} message={setupError ?? "Create a billing period before opening the full-screen meter reading map."} href="/admin/periods" action="Open billing periods" />;
  }

  if (units.length === 0) {
    return <FocusedEmptyState title="No units mapped" message="Add units before using the meter reading map." href="/admin/units" action="Open units" />;
  }

  const svgMarkup = (await readFile(path.join(process.cwd(), "public", "yard-map.svg"), "utf8")).replace(/^<\?xml[^>]*>\s*/, "");
  return <FocusedMeterReadingMap svgMarkup={svgMarkup} units={units} period={period} initialReadings={meterReadings} />;
}