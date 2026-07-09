import { PageHeader, PrimaryButton } from "@/components/ui";
import { Upload } from "lucide-react";

export default function ImportPage() {
  return (
    <>
      <PageHeader title="Historic import" eyebrow="CSV-ready placeholder" action={<PrimaryButton><Upload className="h-5 w-5" />Upload CSV</PrimaryButton>} />
      <section className="rounded-2xl border border-dashed border-estate-500/60 bg-card p-8 text-center shadow-glow">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-estate-500/10 text-estate-500">
          <Upload className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-2xl font-black text-ink">Import old billing data</h2>
        <p className="mx-auto mt-3 max-w-2xl text-secondaryText">
          The MVP is prepared for period, unit, tenant name, reading 1, reading 2, used, subtotal, outstanding, total, paid, and notes columns.
        </p>
        <div className="mt-6 rounded-2xl border border-slateLine bg-sidebar p-4 text-left text-sm font-semibold text-secondaryText">
          period, unit, tenant name, reading 1, reading 2, used, subtotal, outstanding, total, paid, notes
        </div>
      </section>
    </>
  );
}
