import Link from "next/link";
import type { ComponentType, ReactNode } from "react";

export function PageHeader({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-estate-500">{eyebrow}</p> : null}
        <h1 className="text-3xl font-black tracking-tight text-ink md:text-4xl">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = "green", href }: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
  tone?: "green" | "blue" | "purple" | "warning" | "danger";
  href?: string;
}) {
  const tones = {
    green: "text-estate-500 bg-estate-500/10 shadow-[0_0_40px_rgba(34,197,94,0.08)]",
    blue: "text-blue-400 bg-blue-500/10 shadow-[0_0_40px_rgba(59,130,246,0.08)]",
    purple: "text-violet-400 bg-violet-500/10 shadow-[0_0_40px_rgba(139,92,246,0.08)]",
    warning: "text-amber-400 bg-amber-500/10 shadow-[0_0_40px_rgba(245,158,11,0.08)]",
    danger: "text-red-400 bg-red-500/10 shadow-[0_0_40px_rgba(239,68,68,0.08)]"
  };

  const content = (
    <div className="group h-full rounded-2xl border border-slateLine bg-card p-5 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:border-estate-500/40 hover:bg-hover">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-semibold text-secondaryText">{label}</p>
        {Icon ? (
          <div className={`rounded-xl p-3 ${tones[tone]}`}>
            <Icon className="h-6 w-6" />
          </div>
        ) : null}
      </div>
      <div className="mt-4 text-3xl font-black tracking-tight text-ink">{value}</div>
      {hint ? <p className="mt-2 text-sm font-medium text-mutedText">{hint}</p> : null}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{content}</Link> : content;
}

export function PrimaryButton({ children, href }: { children: ReactNode; href?: string }) {
  const className =
    "tap-target inline-flex items-center justify-center gap-2 rounded-2xl bg-estate-500 px-5 py-3 text-base font-bold text-[#07110b] shadow-glow transition duration-200 hover:-translate-y-0.5 hover:bg-estate-600";
  return href ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <button className={className}>{children}</button>
  );
}

export function SecondaryButton({ children, href }: { children: ReactNode; href?: string }) {
  const className =
    "tap-target inline-flex items-center justify-center gap-2 rounded-2xl border border-slateLine bg-card px-5 py-3 text-base font-bold text-ink transition duration-200 hover:-translate-y-0.5 hover:border-estate-500/50 hover:bg-hover";
  return href ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <button type="button" className={className}>{children}</button>
  );
}

export function DataTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slateLine bg-card shadow-soft">
      <table className="min-w-full divide-y divide-slateLine text-left text-sm [&_tbody_tr:nth-child(even)]:bg-white/[0.025] [&_tbody_tr]:transition [&_tbody_tr:hover]:bg-hover">
        {children}
      </table>
    </div>
  );
}

export function Th({ children }: { children: ReactNode }) {
  return <th className="sticky top-0 whitespace-nowrap bg-sidebar px-4 py-4 font-bold text-secondaryText">{children}</th>;
}

export function Td({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return <td className={`whitespace-nowrap px-4 py-4 ${strong ? "font-bold text-ink" : "text-secondaryText"}`}>{children}</td>;
}

export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "good" | "warn" | "bad" | "neutral" }) {
  const tones = {
    good: "bg-estate-500/15 text-estate-500 ring-1 ring-estate-500/25",
    warn: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25",
    bad: "bg-red-500/15 text-red-400 ring-1 ring-red-500/25",
    neutral: "bg-white/5 text-secondaryText ring-1 ring-white/10"
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}


