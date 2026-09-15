import { LogoBadge } from "@/components/logo-badge";
import { SignInForm } from "./sign-in-form";

type SignInPageProps = {
  searchParams: Promise<{ next?: string; reset?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { next, reset } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent px-4 text-foreground">
      <div className="panel w-full max-w-sm space-y-6 neon-frame sign-surface rounded-3xl p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <LogoBadge variant="full" className="w-16" />
          <div>
            <p className="sub text-sm uppercase tracking-[0.3em]">Staff sign in</p>
            <h1 className="glo mt-1 text-xl font-semibold">Chill Bros Command Center</h1>
          </div>
        </div>
        {reset === "1" ? (
          <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Password updated. Sign in with your new password.
          </p>
        ) : null}
        <SignInForm next={next && next.startsWith("/") ? next : "/"} />
        <p className="sub text-center text-xs">Client portal links don&apos;t need an account — use the link sent for your invoice.</p>
      </div>
    </div>
  );
}
