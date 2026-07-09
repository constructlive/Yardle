import { BrandLogo } from "@/components/brand-logo";

export default function MissingBillLinkPage() {
  return <main className="flex min-h-screen items-center justify-center bg-canvas px-5 text-ink"><section className="max-w-lg text-center"><BrandLogo className="mx-auto h-20 w-64" /><h1 className="mt-8 text-3xl font-black">Bill link not found or expired</h1><p className="mt-3 text-lg text-secondaryText">Ask the estate office to send you a new secure bill link.</p></section></main>;
}
