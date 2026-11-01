import { PlatformLogo } from "@/components/platform-logo";

export default function Loading() {
  return (
    <main
      className="fixed inset-0 z-[9999] flex min-h-dvh w-full flex-col items-center justify-center gap-6 bg-[#05090f] px-6 text-center"
      aria-live="polite"
      aria-busy="true"
      aria-label="Chill Pros loading"
    >
      <PlatformLogo priority className="h-40 w-44" />
      <p className="text-sm font-medium text-[#adc0d4]">Getting your workspace ready…</p>
    </main>
  );
}
