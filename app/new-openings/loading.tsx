// Neutral loading screen so buyers never see the app-wide (HVAC company) loading logo.
export default function Loading() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#0B1E33] text-white" aria-busy="true" aria-label="Loading">
      <div className="text-center leading-tight">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7FD4FF]">San Antonio</p>
        <p className="text-xl font-bold uppercase tracking-wide">New Openings</p>
      </div>
    </main>
  );
}
