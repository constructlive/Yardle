"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { saveMeterReading } from "@/lib/actions";
import { calculateUsage } from "@/lib/billing";
import { formatNumber } from "@/lib/money";
import type { BillingPeriod, MeterReading, Unit } from "@/lib/types";
import { Camera, Check, DoorOpen, List, Save, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";

const UNIT_REFS = ["1", "2/3", "4", "5", "6", "7", "8", "9", "10", "11", "11A", "12", "12A", "14", "15", "16", "17", "18", "19", "20/21", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "BOB", "C/WASH", "FLAT 1", "FLAT 2"];
const FOOTPRINT_REFS = ["36", "37", "35", "32", "33", "34", "39", "24", "40", "42", "31", "38", "20/21", "12", "FLAT 2", "FLAT 1", "14", "15", "16", "25", "28", "29", "30", "41", "19", "27", "18", "17", "7", "8", "9", "11", "10", "11A", "12A", "4", "5", "6", "2/3", "43", "44", "BOB", "26", "1", "C/WASH"];
const COLOURS = { waiting: "#EF4444", saved: "#22C55E", problem: "#F59E0B", inactive: "#6B7280", free: "#3B82F6" } as const;
type Status = keyof typeof COLOURS;

function getStatus(unit: Unit, reading?: MeterReading): Status {
  if (unit.freeSupplyMeter) return "free";
  if (unit.status !== "active") return "inactive";
  if (reading?.isEstimated) return "problem";
  return reading ? "saved" : "waiting";
}

export function FocusedMeterReadingMap({ svgMarkup, units, period, initialReadings }: { svgMarkup: string; units: Unit[]; period: BillingPeriod; initialReadings: MeterReading[] }) {
  const orderedUnits = useMemo(() => UNIT_REFS.map((ref) => units.find((unit) => unit.unitReference.toUpperCase() === ref)).filter((unit): unit is Unit => Boolean(unit)), [units]);
  const [readings, setReadings] = useState(initialReadings);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const currentPeriodReadings = readings.filter((reading) => reading.billingPeriodId === period.id);
  const complete = currentPeriodReadings.filter((reading) => orderedUnits.some((unit) => unit.id === reading.unitId && unit.status === "active" && !unit.freeSupplyMeter)).length;
  const selectedUnit = orderedUnits.find((unit) => unit.id === selectedId);

  function saved(reading: MeterReading, reference: string) {
    setReadings((items) => [reading, ...items.filter((item) => !(item.billingPeriodId === period.id && item.unitId === reading.unitId))]);
    setSelectedId(null);
    setToast(`Reading saved for Unit ${reference}`);
    window.setTimeout(() => setToast(""), 2600);
  }

  return <div className="relative h-[100dvh] overflow-hidden bg-[#0b0d0f] text-ink">
    <header className="absolute inset-x-0 top-0 z-30 flex h-20 items-center gap-3 border-b border-slateLine bg-[#121416]/95 px-4 backdrop-blur-xl sm:px-6">
      <BrandLogo className="h-12 w-36 shrink-0 rounded-xl" />
      <div className="hidden min-w-0 flex-1 sm:block"><p className="truncate text-sm font-black text-secondaryText">{period.name}</p><p className="text-xs text-mutedText">Meter reading map</p></div>
      <div className="ml-auto flex items-center gap-2 sm:gap-3"><div className="rounded-xl border border-slateLine bg-card px-3 py-2 text-center"><p className="text-lg font-black text-ink">{complete} / {orderedUnits.filter((unit) => unit.status === "active" && !unit.freeSupplyMeter).length}</p><p className="hidden text-[11px] font-bold text-mutedText sm:block">READINGS</p></div><Link href="/admin/readings/list" className="tap-target inline-flex items-center gap-2 rounded-xl border border-slateLine bg-card px-3 font-black text-secondaryText hover:bg-hover hover:text-ink"><List className="h-5 w-5" /><span className="hidden md:inline">List / Search</span></Link><Link href="/admin" className="tap-target inline-flex items-center gap-2 rounded-xl bg-estate-500 px-4 font-black text-[#07110b]"><DoorOpen className="h-5 w-5" /><span className="hidden sm:inline">Exit</span></Link></div>
    </header>

    <FullScreenMap svgMarkup={svgMarkup} units={orderedUnits} readings={currentPeriodReadings} selectedId={selectedId} onSelect={(unitId) => setSelectedId(unitId)} />
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-wrap justify-center gap-2 rounded-xl border border-slateLine bg-[#121416]/92 px-3 py-2 text-xs font-bold text-secondaryText backdrop-blur"><Legend colour={COLOURS.waiting} label="Not entered" /><Legend colour={COLOURS.saved} label="Reading entered" /><Legend colour={COLOURS.problem} label="Estimated / problem" /><Legend colour={COLOURS.inactive} label="Empty / not used" /><Legend colour={COLOURS.free} label="Free supply" /></div>
    {selectedUnit ? <ReadingModal unit={selectedUnit} period={period} readings={readings} onClose={() => setSelectedId(null)} onSaved={saved} /> : null}
    {toast ? <div role="status" className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-estate-500/40 bg-[#14251a] px-5 py-3 font-black text-white shadow-glow"><Check className="h-5 w-5 text-estate-500" />{toast}</div> : null}
  </div>;
}

function FullScreenMap({ svgMarkup, units, readings, selectedId, onSelect }: { svgMarkup: string; units: Unit[]; readings: MeterReading[]; selectedId: string | null; onSelect: (unitId: string) => void }) {
  const artRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const svg = artRef.current?.querySelector("svg");
    if (!svg) return;
    svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%"); svg.setAttribute("preserveAspectRatio", "xMidYMid meet"); svg.classList.add("yard-map-art"); svg.querySelectorAll(".st9").forEach((element) => ((element as SVGElement).style.display = "none"));
    svg.querySelector("g[data-yardle-overlay]")?.remove();
    const group = Array.from(svg.children).find((child) => child.querySelectorAll?.("rect.st3, polygon.st3").length === 45);
    const footprints = group ? Array.from(group.querySelectorAll<SVGGraphicsElement>("rect.st3, polygon.st3")) : [];
    const overlay = document.createElementNS("http://www.w3.org/2000/svg", "g"); overlay.setAttribute("data-yardle-overlay", "true");
    footprints.forEach((source, index) => {
      const reference = FOOTPRINT_REFS[index];
      const unit = units.find((item) => item.unitReference.toUpperCase() === reference); if (!unit) return;
      const reading = readings.find((item) => item.unitId === unit.id);
      const status = getStatus(unit, reading);
      const shape = source.cloneNode(true) as SVGGraphicsElement;
      shape.removeAttribute("class"); shape.setAttribute("data-unit-id", unit.id); shape.setAttribute("role", "button"); shape.setAttribute("tabindex", "0"); shape.setAttribute("aria-label", `Unit ${unit.unitReference}, ${status}`); shape.setAttribute("fill", COLOURS[status]); shape.setAttribute("fill-opacity", selectedId === unit.id ? "1" : "0.88"); shape.setAttribute("stroke", selectedId === unit.id ? "#FFFFFF" : "#242A30"); shape.setAttribute("stroke-width", selectedId === unit.id ? "1.8" : "0.7"); shape.setAttribute("vector-effect", "non-scaling-stroke"); shape.style.cursor = "pointer"; shape.classList.add("yardle-unit-shape");
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title"); title.textContent = `Unit ${unit.unitReference} - ${unit.tenantName}`; shape.appendChild(title); overlay.appendChild(shape);
      try { const box = source.getBBox(); const point = svg.createSVGPoint(); point.x = box.x + box.width / 2; point.y = box.y + box.height / 2; const matrix = source.transform.baseVal.consolidate()?.matrix; const transformed = matrix ? point.matrixTransform(matrix) : point; const label = document.createElementNS("http://www.w3.org/2000/svg", "text"); label.setAttribute("x", String(transformed.x)); label.setAttribute("y", String(transformed.y)); label.setAttribute("text-anchor", "middle"); label.setAttribute("dominant-baseline", "central"); label.setAttribute("fill", "white"); label.setAttribute("font-size", unit.unitReference.length > 4 ? "3.5" : "5"); label.setAttribute("font-weight", "900"); label.setAttribute("font-family", "Arial, sans-serif"); label.setAttribute("pointer-events", "none"); label.textContent = unit.unitReference; overlay.appendChild(label); } catch {}
    });
    svg.appendChild(overlay);
    return () => overlay.remove();
  }, [units, readings, selectedId]);

  return <main className="absolute inset-x-0 bottom-0 top-20 overflow-hidden">
    <div ref={artRef} onClick={(event) => { const id=(event.target as Element).closest<SVGElement>("[data-unit-id]")?.getAttribute("data-unit-id"); if(id) onSelect(id); }} onKeyDown={(event) => { if(event.key!=="Enter"&&event.key!==" ")return; const id=(event.target as Element).closest<SVGElement>("[data-unit-id]")?.getAttribute("data-unit-id"); if(id) onSelect(id); }} className="h-full w-full [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{__html:svgMarkup}} />
  </main>;
}

function ReadingModal({ unit, period, readings, onClose, onSaved }: { unit: Unit; period: BillingPeriod; readings: MeterReading[]; onClose: () => void; onSaved: (reading: MeterReading, reference: string) => void }) {
  const existing = readings.find((reading) => reading.billingPeriodId === period.id && reading.unitId === unit.id);
  const previousRecord = readings.find((reading) => reading.unitId === unit.id && reading.billingPeriodId !== period.id);
  const previous = existing?.previousReading ?? previousRecord?.currentReading ?? 0;
  const [current, setCurrent] = useState(String(existing?.currentReading ?? previous));
  const [notes, setNotes] = useState(existing?.readingNotes ?? "");
  const [estimated, setEstimated] = useState(Boolean(existing?.isEstimated));
  const [photoName, setPhotoName] = useState("");
  const [pending, startTransition] = useTransition();
  const usage = calculateUsage(previous, Number(current) || 0);
  const inactive = unit.status !== "active" || unit.freeSupplyMeter;

  function save() { if(inactive)return; const data=new FormData(); data.set("periodId",period.id); data.set("unitId",unit.id); data.set("previousReading",String(previous)); data.set("currentReading",current); data.set("readingNotes",notes); if(photoName)data.set("photoUrl",photoName); if(estimated)data.set("isEstimated","on"); startTransition(async()=>{await saveMeterReading(data); onSaved({id:existing?.id??`saved-${period.id}-${unit.id}`,billingPeriodId:period.id,unitId:unit.id,previousReading:previous,currentReading:Number(current)||0,usage,isEstimated:estimated,readingNotes:notes||undefined,photoUrl:photoName||undefined,readingStatus:"confirmed",enteredBy:"user-admin",enteredAt:new Date().toISOString()},unit.unitReference)}); }
  return <div className="fixed inset-0 z-40 grid place-items-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose()}}><section role="dialog" aria-modal="true" aria-label={`Reading for Unit ${unit.unitReference}`} className="w-full max-w-lg rounded-2xl border border-slateLine bg-[#1C2025] p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-black text-estate-500">UNIT {unit.unitReference}</p><h2 className="mt-1 text-xl font-black text-white">{unit.tenantName}</h2>{existing ? <p className="mt-1 text-xs font-bold text-mutedText">Reading entered {new Date(existing.enteredAt).toLocaleString("en-GB")}</p> : null}</div><button aria-label="Close reading" onClick={onClose} className="grid h-12 w-12 place-items-center rounded-xl border border-slateLine bg-sidebar text-secondaryText hover:bg-hover hover:text-white"><X /></button></div>{inactive?<p className="mt-8 rounded-xl border border-slateLine bg-sidebar p-5 text-center font-bold text-secondaryText">This unit is {unit.status.replace("_"," ")} and does not require a reading.</p>:<><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl border border-slateLine bg-sidebar p-4"><p className="text-xs font-black uppercase text-mutedText">Old reading</p><p className="mt-2 text-3xl font-black">{formatNumber(previous)}</p></div><label className="rounded-xl border border-estate-500/50 bg-estate-500/10 p-4"><span className="text-xs font-black uppercase text-estate-500">New reading</span><input autoFocus value={current} onChange={(event)=>setCurrent(event.target.value)} inputMode="decimal" className="mt-1 w-full bg-transparent text-4xl font-black text-white outline-none" /></label></div><div className="mt-3 flex items-center justify-between rounded-xl border border-slateLine bg-sidebar px-4 py-3"><span className="font-bold text-secondaryText">Usage</span><strong className="text-2xl text-white">{formatNumber(usage)} kWh</strong></div><label className="mt-3 flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-slateLine bg-sidebar px-4 font-bold text-secondaryText hover:bg-hover"><Camera className="h-5 w-5 text-estate-500" /><span>{photoName||"Take or upload photo"}</span><input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event)=>setPhotoName(event.target.files?.[0]?.name??"")} /></label><label className="mt-3 flex items-center gap-3 text-sm font-bold text-secondaryText"><input type="checkbox" checked={estimated} onChange={(event)=>setEstimated(event.target.checked)} className="h-5 w-5 accent-red-500" />Estimated / problem reading</label><textarea value={notes} onChange={(event)=>setNotes(event.target.value)} placeholder="Optional note" className="mt-3 min-h-20 w-full rounded-xl border border-slateLine bg-sidebar p-3 font-semibold text-white outline-none focus:border-estate-500" /></>}<div className="mt-5 grid grid-cols-2 gap-3"><button onClick={onClose} className="tap-target rounded-xl border border-slateLine bg-sidebar px-4 font-black text-white hover:bg-hover">Cancel</button><button onClick={save} disabled={pending||inactive} className="tap-target inline-flex items-center justify-center gap-2 rounded-xl bg-estate-500 px-4 font-black text-[#07110b] disabled:opacity-40"><Save className="h-5 w-5" />{pending?"Saving...":"Save reading"}</button></div></section></div>;
}
function Legend({colour,label}:{colour:string;label:string}){return <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full" style={{backgroundColor:colour}} />{label}</span>}