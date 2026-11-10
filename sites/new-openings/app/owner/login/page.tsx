import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";

async function login(form: FormData) {
  "use server";
  if (await signIn(String(form.get("password") ?? ""))) redirect("/owner");
  redirect("/owner/login?e=1");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-8">
      <section className="w-full max-w-md rounded-2xl border border-white/15 bg-[#102A44] p-6 sm:p-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#7FD4FF]">San Antonio New Openings</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Owner sign-in</h1>
      <form action={login} className="mt-5 space-y-3">
        <label htmlFor="owner-password" className="block text-sm font-medium">Password</label>
        <input id="owner-password" autoComplete="current-password" name="password" type="password" required className="h-12 w-full rounded-xl border border-white/15 bg-black/30 px-4 text-white" />
        <button className="h-12 w-full rounded-xl bg-[#F5C542] font-bold text-[#0B1E33]">Sign in</button>
        {e ? <p role="alert" className="text-sm text-[#FF7A59]">Wrong password.</p> : null}
      </form>
      </section>
    </main>
  );
}
