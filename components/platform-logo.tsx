import Image from "next/image";

/** Approved Texas artwork. The CP monogram is reserved for app icons. */
export function PlatformLogo({ className = "", priority = false, decorative = false }: { className?: string; priority?: boolean; decorative?: boolean }) {
  return <Image src="/brand/chill-pros-texas-transparent.png" alt={decorative ? "" : "Chill Pros"} width={1312} height={1199} sizes="(max-width: 640px) 84px, 164px" priority={priority} className={`cp-brand-logo ${className}`} />;
}
