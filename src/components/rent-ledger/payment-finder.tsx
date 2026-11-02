"use client";
import { useState, type ReactNode } from "react";
type Entry = { id: string; search: string; unitIds: string[]; content: ReactNode };
export function PaymentFinder({ entries, units }: { entries: Entry[]; units: { id: string; label: string }[] }) {
  const [query, setQuery] = useState("");
  const [unitId, setUnitId] = useState("");
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const visible = entries.filter(entry => (!unitId || entry.unitIds.includes(unitId)) && terms.every(term => entry.search.includes(term)));
  const field = "mt-1 w-full rounded-xl border border-slateLine bg-sidebar p-3 text-ink";
  return <>
    <section aria-label="Find rent payments" className="space-y-3 rounded-2xl border border-slateLine bg-card p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block font-semibold">Search rent payments<input type="search" className={field} placeholder="Unit number, tenant or account name" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <label className="block font-semibold">Find a unit<select className={field} value={unitId} onChange={event => setUnitId(event.target.value)}><option value="">All units and accounts</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label>
      </div>
      <div className="flex flex-wrap items-center gap-4"><p role="status">Showing {visible.length} of {entries.length} rent accounts</p>{(query || unitId) && <button type="button" className="min-h-11 underline text-amber-200" onClick={() => { setQuery(""); setUnitId(""); }}>Clear filters</button>}</div>
    </section>
    {visible.map(entry => <div key={entry.id}>{entry.content}</div>)}
    {!visible.length && <p>{entries.length ? "No rent accounts match. Try another name or unit number, or clear the filters." : "No rent accounts yet."}</p>}
  </>;
}
