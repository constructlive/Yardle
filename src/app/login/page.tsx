import { BrandLogo } from "@/components/brand-logo";
import { loginAdmin } from "@/lib/auth-actions";
import { SignInButton } from "./sign-in-button";

const messages: Record<string, string> = {
  invalid: "Email or password is incorrect.",
  config: "Admin login is not configured. Check AUTH_SECRET and MariaDB settings."
};

export default function LoginPage({ searchParams }: { searchParams: { error?: string; next?: string } }) {
  const message = searchParams.error ? messages[searchParams.error] ?? messages.invalid : undefined;
  return (
    <main className="grid min-h-screen place-items-center bg-surface px-4 py-10 text-ink">
      <section className="w-full max-w-md rounded-2xl border border-slateLine bg-card p-6 shadow-soft">
        <div className="flex justify-center"><BrandLogo className="h-20 w-64 rounded-3xl" /></div>
        <form action={loginAdmin} className="mt-8 grid gap-4">
          <input type="hidden" name="next" value={searchParams.next ?? "/admin"} />
          <label className="grid gap-2 text-sm font-bold text-secondaryText">Email address<input required autoComplete="username" name="email" className="rounded-2xl border border-slateLine bg-sidebar p-4 text-ink outline-none transition focus:border-estate-500" type="email" placeholder="admin@example.com" /></label>
          <label className="grid gap-2 text-sm font-bold text-secondaryText">Password<input required autoComplete="current-password" name="password" className="rounded-2xl border border-slateLine bg-sidebar p-4 text-ink outline-none transition focus:border-estate-500" type="password" placeholder="Password" /></label>
          {message ? <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400">{message}</p> : null}
          <SignInButton />
        </form>
        <p className="mt-5 text-center text-xs font-bold text-mutedText">Admin access only. No public registration.</p>
        <footer className="mt-8 flex justify-center border-t border-slateLine pt-4"><BrandLogo className="h-8 w-28 rounded-xl p-1" /></footer>
      </section>
    </main>
  );
}