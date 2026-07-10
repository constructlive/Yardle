import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default function HomePage() {
  redirect(getAdminSession() ? "/admin" : "/login");
}