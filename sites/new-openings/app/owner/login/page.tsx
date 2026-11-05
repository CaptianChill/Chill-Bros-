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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-bold uppercase">Owner sign-in</h1>
      <form action={login} className="mt-5 space-y-3">
        <input name="password" type="password" required autoFocus placeholder="Password" className="h-12 w-full rounded-xl border border-white/15 bg-black/30 px-4 text-white" />
        <button className="h-12 w-full rounded-xl bg-[#F5C542] font-bold text-[#0B1E33]">Sign in</button>
        {e ? <p className="text-sm text-[#FF7A59]">Wrong password.</p> : null}
      </form>
    </main>
  );
}
