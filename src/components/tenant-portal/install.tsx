"use client";
import { useEffect, useState } from "react";
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export function InstallPortal() {
  const [install,setInstall]=useState<InstallEvent>();
  useEffect(()=>{const handler=(e:Event)=>{e.preventDefault();setInstall(e as InstallEvent);};window.addEventListener("beforeinstallprompt",handler);return()=>window.removeEventListener("beforeinstallprompt",handler);},[]);
  return <details className="rounded-2xl border border-slateLine bg-card p-4"><summary className="cursor-pointer font-bold">Add Yardle to your home screen</summary><div className="mt-3 space-y-3 text-sm"><p>On iPhone or iPad: open this link in Safari, tap Share, then Add to Home Screen. On Android: open in Chrome and choose Install app or Add to Home screen from the menu.</p>{install&&<button className="rounded-xl bg-amber-400 p-3 font-bold text-slate-950" onClick={async()=>{await install.prompt();await install.userChoice;setInstall(undefined);}}>Install Yardle</button>}<p>Use your own device. This shortcut contains private account access; anyone with the link can view this account. Yardle requires an internet connection and does not save account data for offline use.</p></div></details>;
}
