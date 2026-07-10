import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import { hasDatabaseUrl, query, transaction } from "./db";
import type { AdminSession } from "./session";
import type { PaidStatus, Unit } from "./types";

export type HistoricalImportStatus = "Ready" | "Ready with warning" | "Unit not found" | "Duplicate" | "Invalid" | "Name differs";

export type HistoricalImportPreviewRow = {
  id: string;
  sourceFilename: string;
  sourceRowNumber: number;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  importedUnit: string;
  matchedUnitId?: string;
  matchedUnitReference?: string;
  importedName: string;
  currentTenantName: string;
  previousReading: number | null;
  currentReading: number | null;
  unitsUsed: number | null;
  unitRatePence: number | null;
  levyPence: number | null;
  standingChargePence: number | null;
  usageChargePence: number | null;
  subtotalPence: number | null;
  outstandingBalancePence: number | null;
  totalDuePence: number | null;
  paidStatus: PaidStatus;
  notes: string;
  occupancySnapshot?: "free" | "empty" | "not_used";
  status: HistoricalImportStatus;
  warnings: string[];
  errors: string[];
};

export type HistoricalImportFileSummary = {
  sourceFilename: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  totalRows: number;
  readyRows: number;
  warningRows: number;
  errorRows: number;
  duplicateRows: number;
  warnings: string[];
};

export type HistoricalImportPreviewState = {
  ok: boolean;
  message: string;
  rows: HistoricalImportPreviewRow[];
  summaries: HistoricalImportFileSummary[];
};

export type HistoricalImportCommitState = {
  ok: boolean;
  message: string;
  imported: number;
  skipped: number;
  duplicate: number;
  failed: number;
};

type WorkbookFile = {
  name: string;
  buffer: Buffer;
};

type PeriodDetection = {
  start?: string;
  end?: string;
  warning?: string;
};

type HeaderMap = Record<string, number>;

const monthNumbers = new Map<string, number>(
  [
    ["jan", 1],
    ["january", 1],
    ["feb", 2],
    ["february", 2],
    ["mar", 3],
    ["march", 3],
    ["apr", 4],
    ["april", 4],
    ["may", 5],
    ["jun", 6],
    ["june", 6],
    ["jul", 7],
    ["july", 7],
    ["aug", 8],
    ["august", 8],
    ["sep", 9],
    ["sept", 9],
    ["september", 9],
    ["oct", 10],
    ["october", 10],
    ["nov", 11],
    ["november", 11],
    ["dec", 12],
    ["december", 12]
  ]
);

export function normaliseUnitReference(value: string) {
  return value.trim().replace(/\s+/g, " ").replace(/\s*\/\s*/g, "/").toUpperCase();
}

export function normaliseName(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function moneyToPence(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100);
  const raw = String(value).trim();
  if (!raw || /^[-–—]$/.test(raw)) return null;
  const negative = /^\(.*\)$/.test(raw) || raw.startsWith("-");
  const cleaned = raw.replace(/[£$,\s]/g, "").replace(/[()]/g, "");
  if (!/^[-+]?\d+(\.\d+)?$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) return null;
  return Math.round(Math.abs(amount) * 100) * (negative ? -1 : 1);
}

export function parseMeterNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value).trim().replace(/,/g, "");
  if (!cleaned || /^[-–—]$/.test(cleaned) || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function detectBillingPeriod(values: unknown[], fileName: string, fallbackYear?: number): PeriodDetection {
  const text = values.map((value) => String(value ?? "")).join(" \n ");
  const numeric = text.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\s*(?:-|to|–|—)\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/i);
  if (numeric) {
    const startYear = normaliseYear(numeric[3]);
    const endYear = normaliseYear(numeric[6]);
    return { start: formatDate(startYear, Number(numeric[2]), Number(numeric[1])), end: formatDate(endYear, Number(numeric[5]), Number(numeric[4])) };
  }

  const worded = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s*(?:-|to|–|—)\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s+(\d{4}))?/i);
  if (!worded) return { warning: "No billing period found in workbook." };

  const startMonth = monthNumbers.get(worded[2].toLowerCase());
  const endMonth = monthNumbers.get(worded[4].toLowerCase());
  if (!startMonth || !endMonth) return { warning: "Billing period month could not be read." };

  const fileYear = fileName.match(/(20\d{2})/)?.[1];
  const year = worded[5] ? Number(worded[5]) : fileYear ? Number(fileYear) : fallbackYear;
  if (!year) return { warning: "Billing period year is missing. Enter a fallback year before importing." };

  let endYear = year;
  if (endMonth < startMonth) endYear += 1;
  return { start: formatDate(year, startMonth, Number(worded[1])), end: formatDate(endYear, endMonth, Number(worded[3])) };
}

export async function previewHistoricalImport(input: { files: WorkbookFile[]; units: Unit[]; fallbackYear?: number }): Promise<HistoricalImportPreviewState> {
  if (!input.files.length) {
    return { ok: false, message: "Choose at least one XLSX, XLS or CSV file.", rows: [], summaries: [] };
  }

  const existingKeys = await loadExistingHistoricalKeys();
  const unitsByReference = new Map(input.units.map((unit) => [normaliseUnitReference(unit.unitReference), unit]));
  const seenKeys = new Set<string>();
  const allRows: HistoricalImportPreviewRow[] = [];
  const summaries: HistoricalImportFileSummary[] = [];

  for (const file of input.files) {
    const parsed = parseWorkbook(file, unitsByReference, existingKeys, seenKeys, input.fallbackYear);
    allRows.push(...parsed.rows);
    summaries.push(parsed.summary);
  }

  allRows.sort((left, right) => `${left.billingPeriodStart}|${left.sourceFilename}|${left.sourceRowNumber}`.localeCompare(`${right.billingPeriodStart}|${right.sourceFilename}|${right.sourceRowNumber}`));
  const importable = allRows.filter((row) => row.status === "Ready" || row.status === "Ready with warning" || row.status === "Name differs").length;
  return {
    ok: true,
    message: `${allRows.length} source rows parsed. ${importable} ready to import.`,
    rows: allRows,
    summaries
  };
}

export async function commitHistoricalImport(input: { rows: HistoricalImportPreviewRow[]; estateId: string; session: AdminSession }): Promise<HistoricalImportCommitState> {
  if (!hasDatabaseUrl()) {
    return { ok: false, message: "Historical import commit requires MariaDB. Preview is available in Demo Mode.", imported: 0, skipped: 0, duplicate: 0, failed: 0 };
  }

  const candidateRows = input.rows.filter((row) => row.matchedUnitId && row.billingPeriodStart && row.billingPeriodEnd && (row.status === "Ready" || row.status === "Ready with warning" || row.status === "Name differs"));
  if (!candidateRows.length) {
    return { ok: false, message: "No ready rows were selected for import.", imported: 0, skipped: input.rows.length, duplicate: 0, failed: 0 };
  }

  return transaction(async (client) => {
    const batchId = randomUUID();
    let imported = 0;
    let duplicate = 0;
    let failed = 0;
    const filenames = Array.from(new Set(candidateRows.map((row) => row.sourceFilename))).join(", ");

    await client.query(
      `insert into historical_import_batches (id, estate_id, filenames, uploaded_by, uploaded_at, total_rows, imported_rows, skipped_rows, failed_rows, status)
       values (?,?,?,?,utc_timestamp(),?,0,0,0,'importing')`,
      [batchId, input.estateId, filenames, input.session.userId, input.rows.length]
    );

    for (const row of candidateRows) {
      const existing = await client.query(
        `select id from historical_bills where estate_id = ? and unit_id = ? and billing_period_start = ? and billing_period_end = ? limit 1`,
        [input.estateId, row.matchedUnitId, row.billingPeriodStart, row.billingPeriodEnd]
      );
      if (existing.rows[0]) {
        duplicate += 1;
        continue;
      }

      try {
        await client.query(
          `insert into historical_bills (id, import_batch_id, estate_id, unit_id, billing_period_start, billing_period_end, source_filename, source_row_number, imported_unit_reference, matched_unit_reference, historical_tenant_name, previous_reading, current_reading, units_used, unit_rate_pence, levy_pence, standing_charge_pence, usage_charge_pence, subtotal_pence, outstanding_balance_pence, total_due_pence, paid_status, notes, occupancy_snapshot, source_payload, imported_at)
           values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,utc_timestamp())`,
          [
            randomUUID(),
            batchId,
            input.estateId,
            row.matchedUnitId,
            row.billingPeriodStart,
            row.billingPeriodEnd,
            row.sourceFilename,
            row.sourceRowNumber,
            row.importedUnit,
            row.matchedUnitReference,
            row.importedName || null,
            row.previousReading,
            row.currentReading,
            row.unitsUsed,
            row.unitRatePence,
            row.levyPence,
            row.standingChargePence,
            row.usageChargePence,
            row.subtotalPence,
            row.outstandingBalancePence,
            row.totalDuePence,
            row.paidStatus,
            row.notes || null,
            row.occupancySnapshot || null,
            JSON.stringify({ warnings: row.warnings, errors: row.errors, status: row.status })
          ]
        );
        imported += 1;
      } catch {
        failed += 1;
      }
    }

    const skipped = input.rows.length - imported - failed;
    await client.query(
      "update historical_import_batches set imported_rows=?, skipped_rows=?, failed_rows=?, status=? where id=?",
      [imported, skipped, failed, failed ? "completed_with_errors" : "completed", batchId]
    );

    return { ok: failed === 0, message: `Historical import complete. Imported ${imported}, skipped ${skipped}, duplicates ${duplicate}, failed ${failed}.`, imported, skipped, duplicate, failed };
  });
}

function parseWorkbook(file: WorkbookFile, unitsByReference: Map<string, Unit>, existingKeys: Set<string>, seenKeys: Set<string>, fallbackYear?: number) {
  const workbook = XLSX.read(file.buffer, { type: "buffer", cellDates: false, raw: false });
  const sheetName = workbook.SheetNames.find((name) => name.toLowerCase() === "master") ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  const flatValues = rows.flat();
  const period = detectBillingPeriod(flatValues, file.name, fallbackYear);
  const charges = detectWorkbookCharges(rows);
  const resultRows: HistoricalImportPreviewRow[] = [];
  let header: HeaderMap | undefined;

  rows.forEach((row, index) => {
    const headerCandidate = buildHeaderMap(row);
    if (headerCandidate) {
      header = headerCandidate;
      return;
    }
    if (!header || shouldIgnoreRow(row)) return;

    const previewRow = buildPreviewRow({ row, rowNumber: index + 1, header, period, charges, fileName: file.name, unitsByReference, existingKeys, seenKeys });
    if (previewRow) resultRows.push(previewRow);
  });

  const summary = summariseFile(file.name, period, resultRows);
  return { rows: resultRows, summary };
}

function buildPreviewRow(input: { row: unknown[]; rowNumber: number; header: HeaderMap; period: PeriodDetection; charges: ReturnType<typeof detectWorkbookCharges>; fileName: string; unitsByReference: Map<string, Unit>; existingKeys: Set<string>; seenKeys: Set<string> }): HistoricalImportPreviewRow | undefined {
  const unitText = cellText(input.row[input.header.unit]);
  if (!unitText || shouldIgnoreUnit(unitText)) return undefined;

  const importedName = cellText(input.row[input.header.name]);
  const matchedUnit = input.unitsByReference.get(normaliseUnitReference(unitText));
  const previousReading = parseMeterNumber(input.row[input.header.previous]);
  const currentReading = parseMeterNumber(input.row[input.header.current]);
  const unitsUsed = parseMeterNumber(input.row[input.header.used]);
  const notes = cellText(input.row[input.header.notes]);
  const occupancySnapshot = detectOccupancySnapshot(notes);
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!input.period.start || !input.period.end) errors.push(input.period.warning ?? "Billing period is missing.");
  if (!matchedUnit) errors.push("Unit not found in Yardle.");
  if (previousReading !== null && currentReading !== null && currentReading < previousReading) errors.push("Current reading is below previous reading.");
  if (previousReading !== null && currentReading !== null && unitsUsed !== null && Math.abs(currentReading - previousReading - unitsUsed) > 0.05) warnings.push("Spreadsheet units used differs from current minus previous reading.");
  if (matchedUnit && importedName && matchedUnit.tenantName && normaliseName(importedName) !== normaliseName(matchedUnit.tenantName)) warnings.push(`Imported name differs from current tenant: ${importedName} / ${matchedUnit.tenantName}.`);

  const duplicateKey = matchedUnit && input.period.start && input.period.end ? `${matchedUnit.id}|${input.period.start}|${input.period.end}` : "";
  let duplicate = false;
  if (duplicateKey) {
    duplicate = input.existingKeys.has(duplicateKey) || input.seenKeys.has(duplicateKey);
    input.seenKeys.add(duplicateKey);
  }

  const status = statusForRow(errors, warnings, duplicate);
  return {
    id: `${input.fileName}:${input.rowNumber}`,
    sourceFilename: input.fileName,
    sourceRowNumber: input.rowNumber,
    billingPeriodStart: input.period.start ?? "",
    billingPeriodEnd: input.period.end ?? "",
    importedUnit: unitText,
    matchedUnitId: matchedUnit?.id,
    matchedUnitReference: matchedUnit?.unitReference,
    importedName,
    currentTenantName: matchedUnit?.tenantName ?? "",
    previousReading,
    currentReading,
    unitsUsed,
    unitRatePence: moneyToPence(input.row[input.header.unitRate]) ?? input.charges.unitRatePence,
    levyPence: moneyToPence(input.row[input.header.levy]) ?? input.charges.levyPence,
    standingChargePence: moneyToPence(input.row[input.header.standingCharge]) ?? input.charges.standingChargePence,
    usageChargePence: moneyToPence(input.row[input.header.usageCharge]),
    subtotalPence: moneyToPence(input.row[input.header.subtotal]),
    outstandingBalancePence: moneyToPence(input.row[input.header.outstanding]),
    totalDuePence: moneyToPence(input.row[input.header.total]),
    paidStatus: paidStatusFromCell(input.row[input.header.paid]),
    notes,
    occupancySnapshot,
    status,
    warnings,
    errors
  };
}

function statusForRow(errors: string[], warnings: string[], duplicate: boolean): HistoricalImportStatus {
  if (errors.length) return errors.some((error) => error.includes("Unit not found")) ? "Unit not found" : "Invalid";
  if (duplicate) return "Duplicate";
  if (warnings.some((warning) => warning.includes("Imported name differs"))) return "Name differs";
  if (warnings.length) return "Ready with warning";
  return "Ready";
}

function buildHeaderMap(row: unknown[]): HeaderMap | undefined {
  const labels = row.map((value) => normaliseHeader(cellText(value)));
  const unitIndex = labels.findIndex((value) => value === "UNIT");
  const previousIndex = labels.findIndex((value) => ["READING 1", "READING1", "PREVIOUS", "PREVIOUS READING", "OLD READING"].includes(value));
  const currentIndex = labels.findIndex((value) => ["READING 2", "READING2", "CURRENT", "CURRENT READING", "NEW READING"].includes(value));
  if (unitIndex === -1 || previousIndex === -1 || currentIndex === -1) return undefined;

  return {
    unit: unitIndex,
    name: findHeader(labels, ["NAME", "TENANT", "BUSINESS"]),
    previous: previousIndex,
    current: currentIndex,
    used: findHeader(labels, ["USED", "UNITS USED", "KWH", "UNITS"]),
    usageCharge: findHeader(labels, ["USAGE", "USAGE CHARGE", "ELECTRIC", "ELECTRICITY"]),
    subtotal: findHeader(labels, ["SUB-TOTAL", "SUB TOTAL", "SUBTOTAL", "ROUNDED SUBTOTAL"]),
    outstanding: findHeader(labels, ["O/S", "OS", "OUTSTANDING", "OUTSTANDING BALANCE"]),
    total: findHeader(labels, ["TOTAL", "TOTAL DUE", "DUE"]),
    paid: findHeader(labels, ["PAID", "PAID?", "PAYMENT"]),
    notes: findHeader(labels, ["NOTES", "NOTE"]),
    unitRate: findHeader(labels, ["RATE", "KWH RATE", "PRICE PER KWH"]),
    levy: findHeader(labels, ["LEVY"]),
    standingCharge: findHeader(labels, ["STANDING", "STANDING CHARGE"])
  };
}

function findHeader(labels: string[], candidates: string[]) {
  const index = labels.findIndex((label) => candidates.includes(label));
  return index === -1 ? -1 : index;
}

function detectWorkbookCharges(rows: unknown[][]) {
  let unitRatePence: number | null = null;
  let levyPence: number | null = null;
  let standingChargePence: number | null = null;
  for (const row of rows) {
    row.forEach((value, index) => {
      const label = normaliseHeader(cellText(value));
      const next = row[index + 1];
      if (!unitRatePence && (label.includes("PRICE") || label.includes("KWH RATE"))) unitRatePence = moneyToPence(next);
      if (!levyPence && label === "LEVY") levyPence = moneyToPence(next);
      if (!standingChargePence && label.includes("STANDING")) standingChargePence = moneyToPence(next);
    });
  }
  return { unitRatePence, levyPence, standingChargePence };
}

function summariseFile(sourceFilename: string, period: PeriodDetection, rows: HistoricalImportPreviewRow[]): HistoricalImportFileSummary {
  return {
    sourceFilename,
    billingPeriodStart: period.start,
    billingPeriodEnd: period.end,
    totalRows: rows.length,
    readyRows: rows.filter((row) => row.status === "Ready").length,
    warningRows: rows.filter((row) => row.warnings.length || row.status === "Name differs").length,
    errorRows: rows.filter((row) => row.errors.length).length,
    duplicateRows: rows.filter((row) => row.status === "Duplicate").length,
    warnings: period.warning ? [period.warning] : []
  };
}

async function loadExistingHistoricalKeys() {
  const keys = new Set<string>();
  if (!hasDatabaseUrl()) return keys;
  const result = await query("select unit_id, billing_period_start, billing_period_end from historical_bills");
  result.rows.forEach((row) => {
    const start = dateString(row.billing_period_start);
    const end = dateString(row.billing_period_end);
    keys.add(`${row.unit_id}|${start}|${end}`);
  });
  return keys;
}

function shouldIgnoreRow(row: unknown[]) {
  const joined = row.map((value) => cellText(value)).filter(Boolean).join(" ").toUpperCase();
  if (!joined) return true;
  if (/^(TOTAL|PERIOD)\b/.test(joined)) return true;
  if (/\b(GAMES ROOM METER EST|FIELD METER EST)\b/.test(joined)) return true;
  return false;
}

function shouldIgnoreUnit(value: string) {
  const normalised = normaliseName(value);
  return ["UNIT", "TOTAL", "PERIOD", "GAMES ROOM METER EST.", "FIELD METER EST.", "FIELD METER EST", "GAMES ROOM METER EST"].includes(normalised);
}

function detectOccupancySnapshot(notes: string): "free" | "empty" | "not_used" | undefined {
  const normalised = normaliseName(notes);
  if (normalised.includes("NOT USED")) return "not_used";
  if (normalised.includes("EMPTY")) return "empty";
  if (normalised.includes("FREE")) return "free";
  return undefined;
}

function paidStatusFromCell(value: unknown): PaidStatus {
  const text = normaliseName(cellText(value));
  if (["Y", "YES", "PAID", "TRUE", "1"].includes(text)) return "paid";
  return "unpaid";
}

function cellText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normaliseHeader(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function normaliseYear(value: string) {
  const year = Number(value);
  return year < 100 ? 2000 + year : year;
}

function formatDate(year: number, month: number, day: number) {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function dateString(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}