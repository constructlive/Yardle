import { AdminShell } from "@/components/app-shell";
import { hasDatabaseUrl } from "@/lib/db";
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return <AdminShell demoMode={!hasDatabaseUrl()}>{children}</AdminShell>;
}
