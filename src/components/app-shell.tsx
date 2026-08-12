"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { BrandLogo } from "./brand-logo";
import { logoutAdmin } from "@/lib/auth-actions";
import { BarChart3, Bell, Building2, CalendarClock, ClipboardList, CreditCard, FileText, Gauge, HandCoins, Home, Landmark, LogOut, Menu, MessageSquare, ReceiptText, Settings, Upload, UserCircle, WalletCards, X } from "lucide-react";
import type { BillingPeriod } from "@/lib/types";

type NavLink = [string, string, ComponentType<{ className?: string }>, string];

const utilityLinks: NavLink[] = [
  ["Dashboard", "/admin", Home, "Dashboard"],
  ["Meter Reading", "/admin/readings", Gauge, "Readings"],
  ["Units / Tenants", "/admin/units", Building2, "Units"],
  ["Bill Cycle", "/admin/periods", ClipboardList, "Cycle"],
  ["Bills", "/admin/bills", ReceiptText, "Bills"],
  ["Payments", "/admin/payments", CreditCard, "Payments"],
  ["Payment Checklist", "/admin/landlord", HandCoins, "Checklist"],
  ["Reporting", "/admin/reports", BarChart3, "Reports"],
  ["SMS", "/admin/sms", MessageSquare, "SMS"],
  ["Settings", "/admin/settings", Settings, "Settings"]
];

const rentLinks: NavLink[] = [
  ["Rent Dashboard", "/admin/rent", Home, "Rent"],
  ["Rent Checklist", "/admin/rent/checklist", HandCoins, "Checklist"],
  ["Unit Rent Settings", "/admin/rent/settings", Building2, "Settings"],
  ["Rent Payments", "/admin/rent/payments", WalletCards, "Payments"],
  ["Arrears", "/admin/rent/arrears", CalendarClock, "Arrears"],
  ["Reporting", "/admin/rent/arrears", BarChart3, "Reports"],
  ["SMS", "/admin/sms", MessageSquare, "SMS"],
  ["Settings", "/admin/settings", Settings, "Settings"]
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  if (href === "/admin/rent") return pathname === href;
  return pathname.startsWith(href);
}

function useRouteSplash(pathname: string) {
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    setShowSplash(true);
    const timer = window.setTimeout(() => setShowSplash(false), 1000);
    return () => window.clearTimeout(timer);
  }, [pathname]);
  return showSplash;
}

function LoadingSplash({ show }: { show: boolean }) {
  if (!show) return null;
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-[#121416] transition-opacity duration-300"><div className="animate-pulse"><BrandLogo className="h-24 w-72 rounded-3xl border-slateLine/70 bg-[#121416] p-4 shadow-glow sm:h-28 sm:w-96" /></div></div>;
}

function ModeSwitch({ rentMode, compact = false }: { rentMode: boolean; compact?: boolean }) {
  return <div className={`grid grid-cols-2 rounded-2xl border border-slateLine bg-card p-1 ${compact ? "w-56" : "w-full"}`}><Link href="/admin" className={`rounded-xl px-3 py-2 text-center text-xs font-black uppercase tracking-wide transition ${!rentMode ? "bg-estate-500 text-[#07110b]" : "text-secondaryText hover:bg-hover hover:text-ink"}`}>Utilities</Link><Link href="/admin/rent" className={`rounded-xl px-3 py-2 text-center text-xs font-black uppercase tracking-wide transition ${rentMode ? "bg-estate-500 text-[#07110b]" : "text-secondaryText hover:bg-hover hover:text-ink"}`}>Rent</Link></div>;
}

function ModeHeading({ rentMode }: { rentMode: boolean }) {
  return <section className="rounded-2xl border border-estate-500/25 bg-estate-500/10 p-4"><p className="text-[11px] font-black uppercase tracking-[0.22em] text-estate-500">{rentMode ? "Rent Management" : "Utilities"}</p><p className="mt-1 text-sm font-bold text-secondaryText">{rentMode ? "Rent, arrears and unit payment tracking" : "Electric readings, bill cycle and utility payments"}</p></section>;
}

function NavigationDrawer({ open, pathname, onClose, rentMode }: { open: boolean; pathname: string; onClose: () => void; rentMode: boolean }) {
  if (!open) return null;
  const links = rentMode ? rentLinks : utilityLinks;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="flex h-full w-[min(22rem,88vw)] flex-col border-r border-slateLine bg-sidebar p-4 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <Link href={rentMode ? "/admin/rent" : "/admin"} onClick={onClose} className="rounded-2xl border border-slateLine bg-card p-3"><BrandLogo className="h-12 w-40" /></Link>
          <button onClick={onClose} aria-label="Close menu" className="grid h-11 w-11 place-items-center rounded-xl border border-slateLine bg-card text-secondaryText hover:bg-hover hover:text-ink"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4"><ModeSwitch rentMode={rentMode} /><div className="mt-3"><ModeHeading rentMode={rentMode} /></div></div>
        <nav className="mt-5 grid gap-1 overflow-y-auto">
          {links.map(([label, href, Icon]) => {
            const active = isActive(pathname, href);
            return <Link key={href} href={href} onClick={onClose} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold ${active ? "bg-estate-500/12 text-ink ring-1 ring-estate-500/35" : "text-secondaryText hover:bg-hover hover:text-ink"}`}><Icon className={`h-5 w-5 ${active ? "text-estate-500" : "text-mutedText"}`} />{label}</Link>;
          })}
        </nav>
      </aside>
    </div>
  );
}

export function AdminShell({ children, demoMode = false, billingPeriods = [] }: { children: ReactNode; demoMode?: boolean; billingPeriods?: BillingPeriod[] }) {
  const pathname = usePathname();
  const showSplash = useRouteSplash(pathname);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const focusedReadingMode = pathname === "/admin/readings/map";
  const landlordMode = pathname === "/admin/landlord";
  const rentMode = pathname.startsWith("/admin/rent");
  const links = rentMode ? rentLinks : utilityLinks;
  const defaultPeriodId = billingPeriods.find((period) => period.status === "draft")?.id ?? billingPeriods[0]?.id ?? "";
  const [selectedPeriodId, setSelectedPeriodId] = useState(defaultPeriodId);
  useEffect(() => {
    const periodId = new URLSearchParams(window.location.search).get("periodId");
    setSelectedPeriodId(periodId ?? defaultPeriodId);
  }, [defaultPeriodId, pathname]);
  function selectBillingPeriod(periodId: string) {
    setSelectedPeriodId(periodId);
    const params = new URLSearchParams(window.location.search);
    if (periodId) params.set("periodId", periodId); else params.delete("periodId");
    const query = params.toString();
    window.location.href = query ? `${pathname}?${query}` : pathname;
  }

  if (focusedReadingMode) {
    return <div className="h-[100dvh] overflow-hidden bg-[#0b0d0f]"><LoadingSplash show={showSplash} />{children}</div>;
  }

  return (
    <div className="min-h-screen bg-surface pb-24 text-ink lg:pb-0">
      <LoadingSplash show={showSplash} />
      <NavigationDrawer open={drawerOpen} pathname={pathname} onClose={() => setDrawerOpen(false)} rentMode={rentMode} />
      {!landlordMode ? <aside className="fixed left-0 top-0 hidden h-screen w-72 flex-col border-r border-slateLine bg-sidebar p-5 lg:flex">
        <Link href={rentMode ? "/admin/rent" : "/admin"} className="flex items-center justify-center rounded-2xl border border-slateLine bg-card p-4 shadow-soft"><BrandLogo className="h-16 w-full" /></Link>
        <div className="mt-5"><ModeSwitch rentMode={rentMode} /><div className="mt-3"><ModeHeading rentMode={rentMode} /></div></div>
        <nav className="mt-5 grid flex-1 gap-1.5 overflow-y-auto">{links.map(([label, href, Icon]) => { const active = isActive(pathname, href); return <Link key={href} href={href} className={`group flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold transition duration-200 ${active ? "bg-estate-500/12 text-ink ring-1 ring-estate-500/35" : "text-secondaryText hover:bg-hover hover:text-ink"}`}><Icon className={`h-5 w-5 ${active ? "text-estate-500" : "text-mutedText group-hover:text-estate-500"}`} /><span>{label}</span></Link>; })}</nav>
        <Link href="/admin/import" className="mt-3 grid h-11 place-items-center rounded-xl border border-slateLine bg-card text-mutedText transition hover:bg-hover hover:text-estate-500" title="Import"><Upload className="h-5 w-5" /></Link>
        <div className="mt-4 border-t border-slateLine pt-4 text-center text-xs font-semibold leading-5 text-mutedText">by SIGNSEAL LTD - © Copyright {new Date().getFullYear()}</div>
      </aside> : null}

      <header className={`sticky top-0 z-10 border-b border-slateLine bg-surface/90 px-3 backdrop-blur-xl ${landlordMode ? "py-2" : "py-3 lg:ml-72"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setDrawerOpen(true)} aria-label="Open menu" className={`grid h-11 w-11 place-items-center rounded-xl border border-slateLine bg-card text-secondaryText hover:bg-hover hover:text-ink ${landlordMode ? "" : "lg:hidden"}`}><Menu className="h-5 w-5" /></button>
            <Link href={rentMode ? "/admin/rent" : "/admin"} className="flex items-center"><BrandLogo className={`${landlordMode ? "h-10 w-32" : "h-11 w-32"} shrink-0 rounded-xl`} /></Link>
            {!landlordMode ? <div className="hidden md:block"><ModeSwitch rentMode={rentMode} compact /></div> : null}
            {!rentMode ? <label className="hidden items-center gap-2 xl:flex"><span className="text-[10px] font-black uppercase tracking-wide text-mutedText">Selected billing period</span><select className="max-w-[15rem] rounded-xl border border-slateLine bg-card px-3 py-2 text-sm font-bold text-ink outline-none transition focus:border-estate-500" value={selectedPeriodId} onChange={(event) => selectBillingPeriod(event.target.value)} aria-label="Selected billing period">{billingPeriods.length ? billingPeriods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>) : <option value="">No billing period set</option>}</select></label> : <div className="hidden items-center gap-2 xl:flex"><Landmark className="h-5 w-5 text-estate-500" /><span className="text-xs font-black uppercase tracking-wide text-estate-500">Rent Management</span></div>}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {demoMode ? <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-400">Demo Mode</span> : null}
            {!rentMode ? <Link href={selectedPeriodId ? `/admin/readings?periodId=${selectedPeriodId}` : "/admin/readings"} className="tap-target hidden items-center justify-center gap-2 rounded-xl bg-estate-500 px-4 py-2.5 text-sm font-black text-[#07110b] shadow-glow transition hover:-translate-y-0.5 hover:bg-estate-600 sm:inline-flex"><Gauge className="h-5 w-5" />Enter Readings</Link> : <Link href="/admin/rent/checklist" className="tap-target hidden items-center justify-center gap-2 rounded-xl bg-estate-500 px-4 py-2.5 text-sm font-black text-[#07110b] shadow-glow transition hover:-translate-y-0.5 hover:bg-estate-600 sm:inline-flex"><HandCoins className="h-5 w-5" />Rent Checklist</Link>}
            <button className="grid h-11 w-11 place-items-center rounded-xl border border-slateLine bg-card text-secondaryText transition hover:bg-hover hover:text-ink" aria-label="Notifications"><Bell className="h-5 w-5" /></button>
            <div className="hidden items-center gap-2 xl:flex"><UserCircle className="h-6 w-6 text-mutedText" /><span className="text-sm font-bold text-secondaryText">Estate Admin</span></div>
            <form action={logoutAdmin}><button className="flex h-11 items-center gap-2 rounded-xl border border-slateLine bg-card px-3 font-bold text-secondaryText transition hover:bg-hover hover:text-ink" aria-label="Log out"><LogOut className="h-5 w-5" /><span className="hidden xl:inline">Logout</span></button></form>
          </div>
        </div>
      </header>

      <main className={`${landlordMode ? "px-3 py-4 sm:px-4 xl:px-5" : "px-4 py-8 sm:px-6 lg:ml-72 lg:px-8 xl:px-10"}`}>{children}{!landlordMode ? <footer className="mt-10 flex border-t border-slateLine pt-5"><BrandLogo className="h-8 w-28 rounded-xl p-1" /></footer> : null}</main>

      {!landlordMode ? <nav className="fixed bottom-0 left-0 right-0 z-20 grid grid-cols-5 border-t border-slateLine bg-sidebar/95 backdrop-blur-xl lg:hidden">{links.slice(0, 5).map(([label, href, Icon, shortLabel]) => { const active = isActive(pathname, href); return <Link key={href} href={href} className={`flex flex-col items-center gap-1 py-3 text-[11px] font-bold ${active ? "text-estate-500" : "text-mutedText"}`}><Icon className="h-5 w-5" />{shortLabel}</Link>; })}</nav> : null}
    </div>
  );
}

export function TenantShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showSplash = useRouteSplash(pathname);
  return <div className="min-h-screen bg-surface text-ink"><LoadingSplash show={showSplash} /><header className="border-b border-slateLine bg-surface/90 px-4 py-4 backdrop-blur-xl"><div className="mx-auto flex max-w-6xl items-center justify-between"><Link href="/tenant" className="flex items-center"><BrandLogo className="h-12 w-40 shrink-0" /></Link><nav className="flex gap-2 text-sm font-bold"><Link href="/tenant" className="rounded-2xl px-4 py-3 text-secondaryText transition hover:bg-hover hover:text-ink"><FileText className="mr-2 inline h-4 w-4" />Bills</Link><Link href="/admin" className="rounded-2xl px-4 py-3 text-secondaryText transition hover:bg-hover hover:text-ink">Admin</Link></nav></div></header><main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}<footer className="mt-10 flex border-t border-slateLine pt-5"><BrandLogo className="h-8 w-28 rounded-xl p-1" /></footer></main></div>;
}