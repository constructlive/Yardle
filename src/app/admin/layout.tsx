import { AdminShell } from "@/components/app-shell";
import { hasDatabaseUrl } from "@/lib/db";
import { requireAdminSession } from "@/lib/session";
import type { ReactNode } from "react";

export default async function Layout({ children }: { children: ReactNode }) {
  await requireAdminSession();
  return <AdminShell demoMode={!hasDatabaseUrl()}>{children}</AdminShell>;
}