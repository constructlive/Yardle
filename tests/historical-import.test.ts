import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { detectBillingPeriod, moneyToPence, normaliseUnitReference, previewHistoricalImport } from "../src/lib/historical-import";
import type { Unit } from "../src/lib/types";

const units: Unit[] = [
  unit("u-11a", "11A", "Sign Seal Ltd"),
  unit("u-flat1", "FLAT 1", "Flat Tenant"),
  unit("u-23", "2/3", "Two Three Ltd"),
  unit("u-4", "4", "Current Tenant Ltd")
];

describe("historical import helpers", () => {
  it("normalises unit references without using tenant names", () => {
    expect(normaliseUnitReference("11a")).toBe("11A");
    expect(normaliseUnitReference("flat 1")).toBe("FLAT 1");
    expect(normaliseUnitReference("2 / 3")).toBe("2/3");
  });

  it("converts currency to integer pence", () => {
    expect(moneyToPence("£59.40")).toBe(5940);
    expect(moneyToPence("1,234.56")).toBe(123456);
    expect(moneyToPence("(10.25)")).toBe(-1025);
  });

  it("detects worded periods and requires a year source", () => {
    expect(detectBillingPeriod(["1st June - 30th June"], "19 - July 2026.xlsx")).toMatchObject({ start: "2026-06-01", end: "2026-06-30" });
    expect(detectBillingPeriod(["1st June - 30th June"], "July.xlsx").warning).toContain("year is missing");
    expect(detectBillingPeriod(["01/06/2026 - 30/06/2026"], "anything.xlsx")).toMatchObject({ start: "2026-06-01", end: "2026-06-30" });
  });
});

describe("historical workbook preview", () => {
  it("matches by unit, preserves historical names, and warns on name mismatch", async () => {
    const preview = await previewHistoricalImport({ files: [workbook("19 - July 2026.xlsx", [["1st June - 30th June"], headings(), ["11a", "Signseal", 100.5, 120.75, 20.25, 10.13, 12.5, 0, 12.5, "", ""]])], units });
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0].matchedUnitId).toBe("u-11a");
    expect(preview.rows[0].importedName).toBe("Signseal");
    expect(preview.rows[0].currentTenantName).toBe("Sign Seal Ltd");
    expect(preview.rows[0].status).toBe("Name differs");
  });

  it("ignores repeated headings and total rows", async () => {
    const preview = await previewHistoricalImport({ files: [workbook("June 2026.xlsx", [["1st June - 30th June"], headings(), ["4", "Historical Tenant", 1, 5, 4, 2, 3, 0, 3, "", ""], headings(), ["TOTAL", "", "", "", "", "", 3, 0, 3, "", ""]])], units });
    expect(preview.rows.map((row) => row.importedUnit)).toEqual(["4"]);
  });

  it("marks duplicate unit and period rows", async () => {
    const preview = await previewHistoricalImport({ files: [workbook("June 2026.xlsx", [["1st June - 30th June"], headings(), ["4", "Current Tenant Ltd", 1, 5, 4, 2, 3, 0, 3, "", ""], ["4", "Current Tenant Ltd", 5, 9, 4, 2, 3, 0, 3, "", ""]])], units });
    expect(preview.rows[0].status).toBe("Ready");
    expect(preview.rows[1].status).toBe("Duplicate");
  });

  it("flags invalid readings and keeps current unit occupancy untouched", async () => {
    const before = units.find((item) => item.id === "u-4")!.status;
    const preview = await previewHistoricalImport({ files: [workbook("June 2026.xlsx", [["1st June - 30th June"], headings(), ["4", "Old Tenant", 10, 5, -5, 0, 0, 0, 0, "", "EMPTY"]])], units });
    expect(preview.rows[0].status).toBe("Invalid");
    expect(preview.rows[0].occupancySnapshot).toBe("empty");
    expect(units.find((item) => item.id === "u-4")!.status).toBe(before);
  });
});

function unit(id: string, unitReference: string, tenantName: string): Unit {
  return {
    id,
    estateId: "estate-1",
    unitReference,
    tenantName,
    tenantContactName: "",
    tenantEmail: "",
    tenantMobile: "",
    status: "active",
    freeSupplyMeter: false,
    openingBalancePence: 0,
    currentBalancePence: 0,
    tenantAccessToken: `token-${id}`,
    tenantAccessEnabled: true,
    createdAt: "2026-01-01T00:00:00.000Z"
  };
}

function headings() {
  return ["UNIT", "NAME", "READING 1", "READING 2", "USED", "USAGE", "SUB-TOTAL", "O/S", "TOTAL", "PAID", "NOTES"];
}

function workbook(name: string, rows: unknown[][]) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Master");
  return { name, buffer: Buffer.from(XLSX.write(book, { type: "buffer", bookType: "xlsx" })) };
}