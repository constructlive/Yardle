import { TenantShell } from "@/components/app-shell";
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return <TenantShell>{children}</TenantShell>;
}
