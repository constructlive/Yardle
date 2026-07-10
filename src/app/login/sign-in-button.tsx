"use client";

import { useFormStatus } from "react-dom";
import { LockKeyhole, Loader2 } from "lucide-react";

export function SignInButton() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl bg-estate-500 px-5 py-3 text-base font-bold text-[#07110b] shadow-glow transition hover:bg-estate-600 disabled:cursor-wait disabled:opacity-70">
      {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <LockKeyhole className="h-5 w-5" />}
      {pending ? "Signing in..." : "Sign in"}
    </button>
  );
}