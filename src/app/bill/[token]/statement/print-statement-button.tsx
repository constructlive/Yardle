"use client";

import { Printer } from "lucide-react";

export function PrintStatementButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="tap-target inline-flex items-center gap-2 rounded-2xl bg-estate-500 px-5 py-3 font-black text-[#07110b] shadow-glow print:hidden"
    >
      <Printer className="h-5 w-5" />
      Print / save PDF
    </button>
  );
}
