import { BrandLogo } from "@/components/brand-logo";
import { PrimaryButton } from "@/components/ui";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-surface px-4 py-10 text-ink">
      <section className="w-full max-w-md rounded-2xl border border-slateLine bg-card p-6 shadow-soft">
        <div className="flex justify-center">
          <BrandLogo className="h-20 w-64 rounded-3xl" />
        </div>
        <form className="mt-8 grid gap-4">
          <label className="grid gap-2 text-sm font-bold text-secondaryText">Email address<input className="rounded-2xl border border-slateLine bg-sidebar p-4 text-ink outline-none transition focus:border-estate-500" type="email" placeholder="admin@yardle.local" /></label>
          <label className="grid gap-2 text-sm font-bold text-secondaryText">Password<input className="rounded-2xl border border-slateLine bg-sidebar p-4 text-ink outline-none transition focus:border-estate-500" type="password" placeholder="Password" /></label>
          <PrimaryButton href="/admin">Sign in</PrimaryButton>
        </form>
        <footer className="mt-8 flex justify-center border-t border-slateLine pt-4"><BrandLogo className="h-8 w-28 rounded-xl p-1" /></footer>
      </section>
    </main>
  );
}




