import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70dvh] w-full max-w-4xl items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-[#2d7dff]/35 bg-[#020407]/95 p-6 text-center shadow-[0_0_28px_rgba(45,125,255,0.18)]">
        <SearchX className="mx-auto h-8 w-8 text-[#8ffafa]" />
        <p className="mt-4 font-brand text-xs font-semibold uppercase tracking-[0.25em] text-[#8ffafa]">Chill Bros</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">That page is not available.</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">The link may be old, revoked, or typed incorrectly.</p>
        <Link href="/" className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/45 bg-[#2d7dff]/10 px-5 py-3 text-sm font-medium text-[#d9fbff] transition hover:bg-[#2d7dff]/20"><ArrowLeft className="h-4 w-4" />Back to app</Link>
      </div>
    </main>
  );
}
