import { AdminShell } from "@/components/app-shell";
import { getAppData } from "@/lib/data";
import { hasDatabaseUrl } from "@/lib/db";
import { requireAdminSession } from "@/lib/session";
import type { ReactNode } from "react";

export default async function Layout({ children }: { children: ReactNode }) {
  await requireAdminSession();
  const { billingPeriods } = await getAppData();
  return <AdminShell demoMode={!hasDatabaseUrl()} billingPeriods={billingPeriods}>{children}</AdminShell>;
}