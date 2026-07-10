import { PageHeader } from "@/components/ui";
import { HistoricalImportClient } from "./historical-import-client";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <>
      <PageHeader title="Historic import" eyebrow="Anderson Yard Excel and CSV import" action={null} />
      <HistoricalImportClient />
    </>
  );
}