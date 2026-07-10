"use client";

import { saveMeterReading } from "@/lib/actions";
import { calculateBill, calculateUsage } from "@/lib/billing";
import { formatMoney, formatNumber } from "@/lib/money";
import type { BillingPeriod, MeterReading, Unit } from "@/lib/types";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Gauge, List, Map as MapIcon, Save, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";

const UNIT_REFS = ["1", "2/3", "4", "5", "6", "7", "8", "9", "10", "11", "11A", "12", "12A", "14", "15", "16", "17", "18", "19", "20/21", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "BOB", "C/WASH", "FLAT 1", "FLAT 2"];
const FOOTPRINT_REFS = ["36", "37", "35", "32", "33", "34", "39", "24", "40", "42", "31", "38", "20/21", "12", "FLAT 2", "FLAT 1", "14", "15", "16", "25", "28", "29", "30", "41", "19", "27", "18", "17", "7", "8", "9", "11", "10", "11A", "12A", "4", "5", "6", "2/3", "43", "44", "BOB", "26", "1", "C/WASH"];
const STATUS_COLOURS = { waiting: "#EF4444", saved: "#22C55E", problem: "#F59E0B", inactive: "#6B7280", free: "#3B82F6" } as const;
type MapStatus = keyof typeof STATUS_COLOURS;

function unitStatus(unit: Unit, reading?: MeterReading): MapStatus {
  if (unit.freeSupplyMeter) return "free";
  if (unit.status !== "active") return "inactive";
  if (reading?.isEstimated) return "problem";
  return reading ? "saved" : "waiting";
}

export function MeterReadingWorkspace({ svgMarkup, units, period, initialReadings, initialMode = "map" }: { svgMarkup: string; units: Unit[]; period: BillingPeriod; initialReadings: MeterReading[]; initialMode?: "map" | "list" }) {
  const orderedUnits = useMemo(() => UNIT_REFS.map((ref) => units.find((unit) => unit.unitReference.toUpperCase() === ref)).filter((unit): unit is Unit => Boolean(unit)), [units]);
  const [selectedId, setSelectedId] = useState(orderedUnits[0]?.id ?? "");
  const [readings, setReadings] = useState(initialReadings);
  const [mode, setMode] = useState<"map" | "list">(initialMode);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const selectedUnit = orderedUnits.find((unit) => unit.id === selectedId) ?? orderedUnits[0];
  const selectedIndex = Math.max(0, orderedUnits.findIndex((unit) => unit.id === selectedUnit?.id));
  const periodReadings = readings.filter((reading) => reading.billingPeriodId === period.id);
  const currentReading = periodReadings.find((reading) => reading.unitId === selectedUnit?.id);
  const previousRecord = readings.find((reading) => reading.unitId === selectedUnit?.id && reading.billingPeriodId !== period.id);
  const previous = currentReading?.previousReading ?? previousRecord?.currentReading ?? 0;
  const [currentValue, setCurrentValue] = useState(String(currentReading?.currentReading ?? previous));
  const [estimated, setEstimated] = useState(Boolean(currentReading?.isEstimated));
  const [notes, setNotes] = useState(currentReading?.readingNotes ?? "");

  useEffect(() => {
    setCurrentValue(String(currentReading?.currentReading ?? previous));
    setEstimated(Boolean(currentReading?.isEstimated));
    setNotes(currentReading?.readingNotes ?? "");
  }, [selectedId, currentReading?.id, currentReading?.currentReading, currentReading?.isEstimated, currentReading?.readingNotes, previous]);

  const numericCurrent = Number(currentValue) || 0;
  const usage = calculateUsage(previous, numericCurrent);
  const previewBill = selectedUnit ? calculateBill({ unit: selectedUnit, period, reading: { id: "preview", billingPeriodId: period.id, unitId: selectedUnit.id, previousReading: previous, currentReading: numericCurrent, usage, isEstimated: estimated, readingNotes: notes, readingStatus: "draft", enteredBy: "", enteredAt: new Date().toISOString() } }) : undefined;

  function chooseRelative(delta: number) {
    const next = Math.min(orderedUnits.length - 1, Math.max(0, selectedIndex + delta));
    setSelectedId(orderedUnits[next].id);
  }

  function save(goNext = false) {
    if (!selectedUnit || selectedUnit.status !== "active") return;
    const formData = new FormData();
    formData.set("periodId", period.id);
    formData.set("unitId", selectedUnit.id);
    formData.set("previousReading", String(previous));
    formData.set("currentReading", String(numericCurrent));
    formData.set("readingNotes", notes);
    if (estimated) formData.set("isEstimated", "on");
    startTransition(async () => {
      await saveMeterReading(formData);
      const nextReading: MeterReading = { id: currentReading?.id ?? `saved-${period.id}-${selectedUnit.id}`, billingPeriodId: period.id, unitId: selectedUnit.id, previousReading: previous, currentReading: numericCurrent, usage, isEstimated: estimated, readingNotes: notes || undefined, readingStatus: "confirmed", enteredBy: "user-admin", enteredAt: new Date().toISOString() };
      setReadings((items) => [nextReading, ...items.filter((item) => !(item.billingPeriodId === period.id && item.unitId === selectedUnit.id))]);
      if (goNext && selectedIndex < orderedUnits.length - 1) setSelectedId(orderedUnits[selectedIndex + 1].id);
    });
  }

  const filteredUnits = orderedUnits.filter((unit) => `${unit.unitReference} ${unit.tenantName || "No tenant assigned"}`.toLowerCase().includes(search.toLowerCase()));
  if (!selectedUnit || !previewBill) return <section className="rounded-2xl border border-slateLine bg-card p-8 text-center shadow-soft"><h2 className="text-2xl font-black text-ink">No units mapped</h2><p className="mt-3 font-bold text-mutedText">No database units match the visible yard map labels yet. Use the units page to add matching unit references.</p></section>;

  return <div className="grid gap-6">
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slateLine bg-card p-4 shadow-soft">
      <div className="flex rounded-xl border border-slateLine bg-sidebar p-1"><button onClick={() => setMode("map")} className={`tap-target inline-flex items-center gap-2 rounded-lg px-4 py-2 font-black ${mode === "map" ? "bg-estate-500 text-[#07110b]" : "text-secondaryText"}`}><MapIcon className="h-5 w-5" />Map</button><button onClick={() => setMode("list")} className={`tap-target inline-flex items-center gap-2 rounded-lg px-4 py-2 font-black ${mode === "list" ? "bg-estate-500 text-[#07110b]" : "text-secondaryText"}`}><List className="h-5 w-5" />List / Search</button></div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold text-secondaryText"><Legend colour={STATUS_COLOURS.waiting} label="Not entered" /><Legend colour={STATUS_COLOURS.saved} label="Reading entered" /><Legend colour={STATUS_COLOURS.problem} label="Estimated / problem" /><Legend colour={STATUS_COLOURS.inactive} label="Empty / not used" /><Legend colour={STATUS_COLOURS.free} label="Free supply" /></div>
    </section>

    <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(24rem,0.85fr)]">
      {mode === "map" ? <InteractiveMap svgMarkup={svgMarkup} units={orderedUnits} readings={periodReadings} selectedId={selectedUnit.id} onSelect={setSelectedId} /> : <UnitList units={filteredUnits} readings={periodReadings} selectedId={selectedUnit.id} search={search} setSearch={setSearch} onSelect={setSelectedId} />}
      <ReadingPanel unit={selectedUnit} index={selectedIndex} count={orderedUnits.length} previous={previous} currentValue={currentValue} setCurrentValue={setCurrentValue} usage={usage} bill={previewBill} estimated={estimated} setEstimated={setEstimated} notes={notes} setNotes={setNotes} pending={isPending} onPrevious={() => chooseRelative(-1)} onNext={() => chooseRelative(1)} onSave={() => save(false)} onSaveNext={() => save(true)} />
    </section>
  </div>;
}

function InteractiveMap({ svgMarkup, units, readings, selectedId, onSelect }: { svgMarkup: string; units: Unit[]; readings: MeterReading[]; selectedId: string; onSelect: (id: string) => void }) {
  const artRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = artRef.current;
    const svg = host?.querySelector("svg");
    if (!svg) return;
    svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%"); svg.setAttribute("preserveAspectRatio", "xMidYMid meet"); svg.classList.add("yard-map-art"); svg.querySelectorAll(".st9").forEach((element) => ((element as SVGElement).style.display = "none"));
    svg.querySelector("g[data-yardle-overlay]")?.remove();
    const footprintGroup = Array.from(svg.children).find((child) => child.querySelectorAll?.("rect.st3, polygon.st3").length === 45);
    const footprints = footprintGroup ? Array.from(footprintGroup.querySelectorAll<SVGGraphicsElement>("rect.st3, polygon.st3")) : [];
    const overlay = document.createElementNS("http://www.w3.org/2000/svg", "g"); overlay.setAttribute("data-yardle-overlay", "true");
    footprints.forEach((source, index) => {
      const reference = FOOTPRINT_REFS[index];
      const unit = units.find((item) => item.unitReference.toUpperCase() === reference); if (!unit) return;
      const reading = readings.find((item) => item.unitId === unit.id);
      const status = unitStatus(unit, reading);
      const shape = source.cloneNode(true) as SVGGraphicsElement;
      shape.removeAttribute("class"); shape.setAttribute("fill", STATUS_COLOURS[status]); shape.setAttribute("fill-opacity", unit.id === selectedId ? "0.96" : "0.82"); shape.setAttribute("stroke", unit.id === selectedId ? "#FFFFFF" : "#2D333A"); shape.setAttribute("stroke-width", unit.id === selectedId ? "1.8" : "0.65"); shape.setAttribute("vector-effect", "non-scaling-stroke"); shape.setAttribute("data-unit-id", unit.id); shape.setAttribute("role", "button"); shape.setAttribute("tabindex", "0"); shape.setAttribute("aria-label", `Unit ${unit.unitReference}, ${status.replace("inactive", "empty or not used")}`); shape.style.cursor = "pointer"; shape.classList.add("yardle-unit-shape");
      const activate = () => onSelect(unit.id); shape.addEventListener("click", activate); shape.addEventListener("keydown", (event) => { if ((event as KeyboardEvent).key === "Enter" || (event as KeyboardEvent).key === " ") activate(); });
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title"); title.textContent = `Unit ${unit.unitReference} - ${unit.tenantName || "No tenant assigned"}`; shape.appendChild(title); overlay.appendChild(shape);
      try { const box = source.getBBox(); const point = svg.createSVGPoint(); point.x = box.x + box.width / 2; point.y = box.y + box.height / 2; const matrix = source.transform.baseVal.consolidate()?.matrix; const transformed = matrix ? point.matrixTransform(matrix) : point; const label = document.createElementNS("http://www.w3.org/2000/svg", "text"); label.setAttribute("x", String(transformed.x)); label.setAttribute("y", String(transformed.y)); label.setAttribute("text-anchor", "middle"); label.setAttribute("dominant-baseline", "central"); label.setAttribute("fill", "#FFFFFF"); label.setAttribute("font-size", unit.unitReference.length > 4 ? "3.3" : "4.6"); label.setAttribute("font-weight", "800"); label.setAttribute("font-family", "Arial, sans-serif"); label.setAttribute("pointer-events", "none"); label.textContent = unit.unitReference; overlay.appendChild(label); } catch {}
    });
    svg.appendChild(overlay);
    return () => overlay.remove();
  }, [units, readings, selectedId, onSelect]);

  return <div className="overflow-hidden rounded-2xl border border-slateLine bg-[#0c0e10] shadow-soft">
    <div className="border-b border-slateLine bg-card px-4 py-3"><h2 className="font-black text-ink">Interactive yard map</h2><p className="text-sm text-mutedText">Tap a coloured unit to enter its reading</p></div>
    <div className="relative h-[62vh] min-h-[34rem] overflow-hidden">
      <div ref={artRef} onClick={(event) => { const shape = (event.target as Element).closest<SVGElement>("[data-unit-id]"); const unitId = shape?.getAttribute("data-unit-id"); if (unitId) onSelect(unitId); }} className="h-full w-full [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svgMarkup }} />
    </div>
  </div>;
}

function UnitList({ units, readings, selectedId, search, setSearch, onSelect }: { units: Unit[]; readings: MeterReading[]; selectedId: string; search: string; setSearch: (value: string) => void; onSelect: (id: string) => void }) { return <div className="rounded-2xl border border-slateLine bg-card p-5 shadow-soft"><label className="relative block"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-mutedText" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search unit or business" className="w-full rounded-xl border border-slateLine bg-sidebar py-3 pl-12 pr-4 font-bold text-ink outline-none focus:border-estate-500" /></label><div className="mt-4 grid max-h-[62vh] gap-2 overflow-auto">{units.map((unit) => { const status = unitStatus(unit, readings.find((reading) => reading.unitId === unit.id)); return <button key={unit.id} onClick={() => onSelect(unit.id)} className={`flex min-h-16 items-center justify-between gap-4 rounded-xl border px-4 text-left transition ${selectedId === unit.id ? "border-estate-500 bg-estate-500/10" : "border-slateLine bg-sidebar hover:bg-hover"}`}><span><strong className="block text-ink">Unit {unit.unitReference}</strong><span className="text-sm text-mutedText">{unit.tenantName || "No tenant assigned"}</span>{readings.find((reading) => reading.unitId === unit.id) ? <span className="mt-1 block text-xs font-semibold text-mutedText">Read {new Date(readings.find((reading) => reading.unitId === unit.id)!.enteredAt).toLocaleString("en-GB")}</span> : null}</span><span className="h-3 w-3 rounded-full" style={{ backgroundColor: STATUS_COLOURS[status] }} /></button>; })}</div></div>; }

function ReadingPanel({ unit, index, count, previous, currentValue, setCurrentValue, usage, bill, estimated, setEstimated, notes, setNotes, pending, onPrevious, onNext, onSave, onSaveNext }: any) { const inactive = unit.status !== "active" || unit.freeSupplyMeter; return <div className="rounded-2xl border border-slateLine bg-card p-5 shadow-glow md:p-6"><div className="flex items-start justify-between gap-4 border-b border-slateLine pb-5"><div><p className="font-black text-estate-500">Unit {unit.unitReference} - {index + 1} of {count}</p><h2 className="mt-2 text-3xl font-black text-ink">{unit.tenantName || "No tenant assigned"}</h2></div><span className="rounded-full px-3 py-1 text-sm font-black text-white" style={{ backgroundColor: STATUS_COLOURS[unitStatus(unit)] }}>{inactive ? "No reading required" : "Reading entry"}</span></div>{inactive ? <div className="py-10 text-center"><AlertTriangle className="mx-auto h-10 w-10 text-mutedText" /><p className="mt-4 text-lg font-bold text-secondaryText">This unit is {unit.status.replace("_", " ")}.</p></div> : <><div className="mt-5 grid gap-4 sm:grid-cols-2"><Metric label="Previous reading" value={formatNumber(previous)} /><label className="rounded-2xl border border-estate-500/40 bg-estate-500/10 p-4"><span className="text-sm font-black uppercase text-estate-500">Current reading</span><input value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} inputMode="decimal" className="mt-2 w-full bg-transparent text-4xl font-black text-ink outline-none" /></label><Metric label="Usage" value={`${formatNumber(usage)} kWh`} /><Metric label="Current bill" value={formatMoney(bill.subtotalPence)} /><Metric label="Outstanding" value={formatMoney(bill.outstandingCarriedForwardPence)} warning /><Metric label="Total due" value={formatMoney(bill.roundedTotalPence)} /></div><label className="mt-4 flex min-h-14 items-center gap-3 rounded-xl border border-slateLine bg-sidebar px-4 font-bold text-secondaryText"><input type="checkbox" checked={estimated} onChange={(event) => setEstimated(event.target.checked)} className="h-6 w-6 accent-estate-500" />Estimated / problem reading</label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-4 min-h-24 w-full rounded-xl border border-slateLine bg-sidebar p-4 font-semibold text-ink outline-none focus:border-estate-500" placeholder="Reading notes" /></>}<div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><button onClick={onPrevious} disabled={index === 0} className="tap-target inline-flex items-center justify-center gap-2 rounded-xl border border-slateLine bg-sidebar px-3 font-black text-ink disabled:opacity-30"><ChevronLeft />Previous</button><button onClick={onNext} disabled={index === count - 1} className="tap-target inline-flex items-center justify-center gap-2 rounded-xl border border-slateLine bg-sidebar px-3 font-black text-ink disabled:opacity-30">Next<ChevronRight /></button><button onClick={onSave} disabled={pending || inactive} className="tap-target inline-flex items-center justify-center gap-2 rounded-xl bg-estate-500 px-3 font-black text-[#07110b] disabled:opacity-40"><Save />{pending ? "Saving" : "Save"}</button><button onClick={onSaveNext} disabled={pending || inactive} className="tap-target inline-flex items-center justify-center gap-2 rounded-xl bg-estate-500 px-3 font-black text-[#07110b] disabled:opacity-40"><Check />Save & Next</button></div></div>; }
function Metric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) { return <div className="rounded-2xl border border-slateLine bg-sidebar p-4"><p className="text-sm font-black uppercase text-mutedText">{label}</p><p className={`mt-2 text-3xl font-black ${warning ? "text-amber-400" : "text-ink"}`}>{value}</p></div>; }
function Legend({ colour, label }: { colour: string; label: string }) { return <span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-full" style={{ backgroundColor: colour }} />{label}</span>; }


