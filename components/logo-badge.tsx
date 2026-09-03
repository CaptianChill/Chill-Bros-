import Image from "next/image";

type LogoBadgeProps = {
  variant?: "icon" | "text" | "full";
  className?: string;
};

const imageSources = {
  icon: { src: "/logo.png", alt: "Chill Bros neon logo", width: 220, height: 220 },
  full: { src: "/logo.png", alt: "Chill Bros neon logo", width: 220, height: 220 },
};

export function LogoBadge({ variant = "full", className = "" }: LogoBadgeProps) {
  if (variant === "text") {
    return (
      <div className={`neon-frame sign-surface flex flex-col items-center justify-center rounded-2xl px-4 py-3 ${className}`}>
        <p className="font-brand neon-text text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">Chill Bros</p>
        <p className="font-brand mt-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#d9fbff] sm:text-xs">Operational Command Center</p>
      </div>
    );
  }

  const image = imageSources[variant];

  return (
    <div className={`neon-frame overflow-hidden rounded-2xl bg-background/90 ${className}`}>
      <Image
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        priority
        className="h-auto w-full object-contain"
      />
    </div>
  );
}
