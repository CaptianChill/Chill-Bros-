import { LogoBadge } from "@/components/logo-badge";
import { SignInForm } from "./sign-in-form";

type SignInPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <div className="w-full max-w-sm space-y-6 rounded-3xl border border-[#00f0f0]/40 bg-zinc-950/90 p-6 shadow-[0_0_55px_rgba(0,240,240,0.12)]">
        <div className="flex flex-col items-center gap-3 text-center">
          <LogoBadge variant="icon" className="w-16" />
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Staff sign in</p>
            <h1 className="mt-1 text-xl font-semibold text-white">Chill Bros Command Center</h1>
          </div>
        </div>
        <SignInForm next={next && next.startsWith("/") ? next : "/"} />
        <p className="text-center text-xs text-zinc-500">Client portal links don&apos;t need an account — use the link sent for your invoice.</p>
      </div>
    </div>
  );
}
