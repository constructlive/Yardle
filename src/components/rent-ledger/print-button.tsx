"use client";
export function PrintStatement() { return <button className="rounded-xl bg-amber-400 px-4 py-3 font-bold text-black print:hidden" onClick={() => window.print()}>Print / save PDF</button>; }
