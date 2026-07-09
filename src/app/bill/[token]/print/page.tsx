import { BrandLogo } from "@/components/brand-logo";
import { getPublicBillData } from "@/lib/data";
import { generateBillHtml } from "@/lib/pdf";
import { notFound } from "next/navigation";

export default async function SecureBillPrintPage({ params }: { params: { token: string } }) {
  const data = await getPublicBillData(params.token);
  if (!data?.bills[0]) notFound();
  const bill = data.bills[0];
  const period = data.billingPeriods.find((item) => item.id === bill.billingPeriodId);
  if (!period) notFound();
  return <main className="min-h-screen bg-canvas p-4 text-ink sm:p-8"><div className="mx-auto mb-4 flex max-w-5xl items-center justify-between gap-4"><BrandLogo className="h-12 w-40" /><p className="text-sm text-secondaryText">Use your browser print menu to save as PDF</p></div><iframe title="Yardle bill PDF" className="mx-auto h-[70rem] w-full max-w-5xl rounded-2xl border border-slateLine bg-white" srcDoc={generateBillHtml(data.estate, data.unit, period, bill)} /></main>;
}
