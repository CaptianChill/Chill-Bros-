import Image from "next/image";

export default function Loading() {
  return (
    <main
      className="fixed inset-0 z-[9999] flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[#0A1A33]"
      aria-live="polite"
      aria-busy="true"
      aria-label="Chill Pros loading"
    >
      {/* Shown whole (no crop); navy fills any space on taller screens. */}
      <Image
        src="/brand/chill-pros-loading.webp"
        alt="A Chill Pro"
        fill
        priority
        sizes="100vw"
        className="object-contain"
      />
    </main>
  );
}
