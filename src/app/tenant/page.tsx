import { BrandLogo } from "@/components/brand-logo";
import { Link2 } from "lucide-react";

export default function TenantPage() {
  return <main className="flex min-h-[70vh] items-center justify-center px-5 py-12 text-ink"><section className="max-w-lg text-center"><BrandLogo className="mx-auto h-20 w-64" /><Link2 className="mx-auto mt-8 h-10 w-10 text-estate-500" /><h1 className="mt-4 text-3xl font-black">Online Bill Access</h1><p className="mt-3 text-lg leading-7 text-secondaryText">Tenants do not need to sign in. Open the secure bill link sent to you by SMS or email.</p></section></main>;
}
