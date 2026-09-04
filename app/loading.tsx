export default function Loading() {
  return (
    <main className="mx-auto flex min-h-[70dvh] w-full max-w-4xl items-center justify-center px-4 py-12" aria-live="polite" aria-busy="true">
      <div className="w-full max-w-md rounded-3xl border border-[#2d7dff]/35 bg-[#020407]/92 p-6 text-center shadow-[0_0_28px_rgba(45,125,255,0.18)]">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#2d7dff]/25 border-t-[#8ffafa]" />
        <p className="mt-4 font-brand text-sm font-semibold uppercase tracking-[0.24em] text-[#8ffafa]">Chill Bros</p>
        <p className="mt-2 text-sm text-zinc-400">Loading live operational data…</p>
      </div>
    </main>
  );
}
