import { LogoBadge } from "@/components/logo-badge";
import { SignInForm } from "./sign-in-form";

type SignInPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent px-4 text-foreground">
      <div className="w-full max-w-sm space-y-6 neon-frame sign-surface rounded-3xl p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <LogoBadge variant="full" className="w-16" />
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Staff sign in</p>
            <h1 className="neon-text mt-1 text-xl font-semibold text-white">Chill Bros Command Center</h1>
          </div>
        </div>
        <SignInForm next={next && next.startsWith("/") ? next : "/"} />
        <p className="text-center text-xs text-zinc-500">Client portal links don&apos;t need an account — use the link sent for your invoice.</p>
      </div>
    </div>
  );
}
