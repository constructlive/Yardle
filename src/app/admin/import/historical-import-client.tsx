"use client";

import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { confirmHistoricalImportAction, previewHistoricalImportAction } from "@/lib/actions";
import { formatMoney, formatNumber } from "@/lib/money";
import type { HistoricalImportCommitState, HistoricalImportPreviewState } from "@/lib/historical-import";

const initialPreview: HistoricalImportPreviewState = { ok: false, message: "Upload Anderson Yard workbooks to preview historical bills before importing.", rows: [], summaries: [] };
const initialCommit: HistoricalImportCommitState = { ok: false, message: "", imported: 0, skipped: 0, duplicate: 0, failed: 0 };
const filters = ["all", "ready", "warnings", "errors", "duplicates"] as const;

type Filter = (typeof filters)[number];

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl bg-estate-500 px-5 py-3 text-base font-black text-[#07110b] shadow-glow transition hover:-translate-y-0.5 hover:bg-estate-600 disabled:cursor-not-allowed disabled:opacity-60"><Upload className="h-5 w-5" />{pending ? pendingLabel : label}</button>;
}

export function HistoricalImportClient() {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [preview, previewAction] = useFormState(previewHistoricalImportAction, initialPreview);
  const [commit, commitAction] = useFormState(confirmHistoricalImportAction, initialCommit);
  const [filter, setFilter] = useState<Filter>("all");

  const visibleRows = useMemo(() => preview.rows.filter((row) => {
    if (filter === "ready") return row.status === "Ready";
    if (filter === "warnings") return row.warnings.length || row.status === "Name differs" || row.status === "Ready with warning";
    if (filter === "errors") return row.errors.length || row.status === "Invalid" || row.status === "Unit not found";
    if (filter === "duplicates") return row.status === "Duplicate";
    return true;
  }), [preview.rows, filter]);

  const readyCount = preview.rows.filter((row) => ["Ready", "Ready with warning", "Name differs"].includes(row.status)).length;
  const rowsJson = JSON.stringify(preview.rows);

  return (
    <div className="space-y-6">
      <form action={previewAction} encType="multipart/form-data" className="grid gap-5 rounded-2xl border border-slateLine bg-card p-5 shadow-soft">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-black text-ink">Anderson Yard historical import</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-secondaryText">Upload one or more monthly Master workbooks. Yardle matches rows by unit reference only and preserves the spreadsheet name as the historical billed-to snapshot.</p>
          </div>
          <span className="rounded-full border border-estate-500/30 bg-estate-500/10 px-3 py-1 text-xs font-black uppercase text-estate-500">Historical only, no SMS</span>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_180px_auto]">
          <label className="grid gap-2 text-sm font-black uppercase tracking-wide text-muted">
            Workbooks or CSV files
            <input name="files" type="file" accept=".xlsx,.xls,.csv" multiple required onChange={handleFileChange(setSelectedFiles)} className="rounded-xl border border-dashed border-slateLine bg-sidebar p-3 text-sm font-bold text-secondaryText file:mr-4 file:rounded-xl file:border-0 file:bg-estate-500 file:px-4 file:py-2 file:font-black file:text-[#07110b]" />
            <span className="rounded-xl border border-slateLine bg-[#101214] px-3 py-2 text-xs font-bold normal-case tracking-normal text-secondaryText">{selectedFiles.length ? selectedFiles.join(", ") : "No file selected yet"}</span>
          </label>
          <label className="grid gap-2 text-sm font-black uppercase tracking-wide text-muted">
            Fallback year
            <input name="fallbackYear" inputMode="numeric" placeholder="2026" className="rounded-xl border border-slateLine bg-sidebar p-3 text-base font-bold text-ink outline-none focus:border-estate-500" />
          </label>
          <div className="flex items-end"><SubmitButton label="Upload and preview" pendingLabel="Uploading..." /></div>
        </div>
        <label className="flex items-center gap-3 rounded-xl border border-slateLine bg-sidebar p-3 text-sm font-bold text-secondaryText"><input type="checkbox" checked readOnly className="h-5 w-5 accent-estate-500" />Import as historical records without notifications</label><p className="text-xs font-semibold text-muted">If a workbook period has no year and the filename has no year, enter the year here before previewing. Yardle will not guess silently.</p>
      </form>

      <section className="grid gap-4 md:grid-cols-4">
        <Summary label="Parsed rows" value={preview.rows.length} />
        <Summary label="Ready" value={readyCount} />
        <Summary label="Warnings" value={preview.rows.filter((row) => row.warnings.length).length} />
        <Summary label="Errors / duplicates" value={preview.rows.filter((row) => row.errors.length || row.status === "Duplicate").length} />
      </section>

      <div className={`rounded-2xl border p-4 text-sm font-bold ${preview.ok ? "border-estate-500/30 bg-estate-500/10 text-green-100" : "border-slateLine bg-card text-secondaryText"}`}>{preview.message}</div>

      {preview.summaries.length ? <section className="rounded-2xl border border-slateLine bg-card p-5 shadow-soft"><h2 className="text-xl font-black text-ink">File summary</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{preview.summaries.map((summary) => <div key={summary.sourceFilename} className="rounded-xl border border-slateLine bg-sidebar p-4"><p className="font-black text-ink">{summary.sourceFilename}</p><p className="mt-1 text-sm font-bold text-secondaryText">{summary.billingPeriodStart && summary.billingPeriodEnd ? `${summary.billingPeriodStart} to ${summary.billingPeriodEnd}` : "Period needs attention"}</p><p className="mt-2 text-xs font-bold text-muted">Rows {summary.totalRows} Â· Ready {summary.readyRows} Â· Warnings {summary.warningRows} Â· Errors {summary.errorRows} Â· Duplicates {summary.duplicateRows}</p>{summary.warnings.map((warning) => <p key={warning} className="mt-2 text-xs font-bold text-amber-300">{warning}</p>)}</div>)}</div></section> : null}

      {preview.rows.length ? (
        <section className="rounded-2xl border border-slateLine bg-card shadow-soft">
          <div className="flex flex-col gap-4 border-b border-slateLine p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black text-ink">Preview rows</h2>
              <p className="text-sm font-bold text-secondaryText">Name differences are warnings. Unit matching uses the Unit column only.</p>
            </div>
            <div className="flex flex-wrap gap-2">{filters.map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-xl px-3 py-2 text-sm font-black capitalize ${filter === item ? "bg-estate-500 text-[#07110b]" : "border border-slateLine bg-sidebar text-secondaryText"}`}>{item}</button>)}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1300px] divide-y divide-slateLine text-left text-sm">
              <thead className="bg-sidebar text-secondaryText"><tr><Th>File</Th><Th>Period</Th><Th>Unit</Th><Th>Matched</Th><Th>Imported name</Th><Th>Current tenant</Th><Th>Readings</Th><Th>Used</Th><Th>Subtotal</Th><Th>O/S</Th><Th>Total</Th><Th>Notes</Th><Th>Status</Th><Th>Warnings</Th></tr></thead>
              <tbody className="divide-y divide-slateLine">{visibleRows.map((row) => <tr key={row.id} className="hover:bg-hover"><Td>{row.sourceFilename}</Td><Td>{row.billingPeriodStart || "-"}<br />{row.billingPeriodEnd || "-"}</Td><Td strong>{row.importedUnit}</Td><Td>{row.matchedUnitReference || "-"}</Td><Td>{row.importedName || "-"}</Td><Td>{row.currentTenantName || "Vacant"}</Td><Td>{value(row.previousReading)} / {value(row.currentReading)}</Td><Td>{value(row.unitsUsed)}</Td><Td>{money(row.subtotalPence)}</Td><Td>{money(row.outstandingBalancePence)}</Td><Td>{money(row.totalDuePence)}</Td><Td>{row.notes || "-"}</Td><Td><Status status={row.status} /></Td><Td>{[...row.warnings, ...row.errors].join(" ") || "-"}</Td></tr>)}</tbody>
            </table>
          </div>
          <form action={commitAction} className="flex flex-col gap-3 border-t border-slateLine p-5 md:flex-row md:items-center md:justify-between">
            <input type="hidden" name="rows" value={rowsJson} />
            <p className="text-sm font-bold text-secondaryText">Default mode: import as historical records without notifications.</p>
            <button disabled={!readyCount} className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl bg-estate-500 px-5 py-3 text-base font-black text-[#07110b] shadow-glow disabled:opacity-50"><CheckCircle2 className="h-5 w-5" />Confirm historical import</button>
          </form>
          {commit.message ? <div className={`border-t border-slateLine p-4 text-sm font-bold ${commit.ok ? "text-green-100" : "text-red-100"}`}>{commit.message}</div> : null}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-slateLine bg-card p-10 text-center text-secondaryText"><FileSpreadsheet className="mx-auto h-10 w-10 text-estate-500" /><p className="mt-4 font-bold">No preview rows yet.</p></section>
      )}
    </div>
  );
}

function handleFileChange(setSelectedFiles: (files: string[]) => void) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(Array.from(event.target.files ?? []).map((file) => file.name));
  };
}
function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-slateLine bg-card p-5 shadow-soft"><p className="text-sm font-bold text-secondaryText">{label}</p><p className="mt-2 text-3xl font-black text-ink">{value}</p></div>;
}

function Status({ status }: { status: string }) {
  const style = status === "Ready" ? "bg-estate-500/15 text-estate-500" : status === "Duplicate" || status === "Invalid" || status === "Unit not found" ? "bg-red-500/15 text-red-300" : "bg-amber-500/15 text-amber-300";
  return <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${style}`}>{status !== "Ready" ? <AlertTriangle className="h-3 w-3" /> : null}{status}</span>;
}

function Th({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3 font-black">{children}</th>;
}

function Td({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return <td className={`whitespace-nowrap px-4 py-3 align-top ${strong ? "font-black text-ink" : "font-semibold text-secondaryText"}`}>{children}</td>;
}

function value(input: number | null) {
  return input === null ? "-" : formatNumber(input);
}

function money(input: number | null) {
  return input === null ? "-" : formatMoney(input);
}
