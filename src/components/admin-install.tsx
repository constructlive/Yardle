"use client";
import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{outcome:"accepted"|"dismissed"}> };
export function AdminInstall() {
  const [prompt,setPrompt] = useState<InstallPrompt>();
  const [installed,setInstalled] = useState(false);
  const [error,setError] = useState("");
  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const update = () => setInstalled(display.matches || !!(navigator as Navigator & {standalone?:boolean}).standalone);
    const ready = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const done = () => { setInstalled(true); setPrompt(undefined); };
    update(); display.addEventListener("change",update);
    window.addEventListener("beforeinstallprompt",ready); window.addEventListener("appinstalled",done);
    return () => { display.removeEventListener("change",update); window.removeEventListener("beforeinstallprompt",ready); window.removeEventListener("appinstalled",done); };
  },[]);
  if (installed) return null;
  return <section className="mt-6 space-y-3 rounded-xl border border-slateLine p-4 text-sm" aria-label="Install admin app">
    <h2 className="font-bold">Install Yardle Admin</h2>
    <p>Open your admin dashboard as an app from your phone’s home screen. Sign-in is still required.</p>
    {prompt ? <button type="button" className="w-full rounded-xl bg-amber-400 px-4 py-3 font-bold text-slate-950" onClick={async()=>{
      const pending=prompt;setPrompt(undefined);setError("");
      try { await pending.prompt(); await pending.userChoice; }
      catch { setError("Open Chrome’s menu and choose Install app, or reload this page to try again."); }
    }}>Install Yardle Admin</button> : <p>On Android, open this page in Chrome, tap ⋮, then <strong>Install app</strong> or <strong>Add to Home screen → Install</strong>. If Chrome hasn’t offered installation yet, reload this page while online.</p>}
    <p className="text-xs text-mutedText">Internet connection required. Private account records are not stored for offline use. This is the admin app; tenants install from their own private portal link.</p>
    {error&&<p role="alert" className="text-red-300">{error}</p>}
  </section>;
}
