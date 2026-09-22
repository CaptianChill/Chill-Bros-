import Image from "next/image";

type LogoBadgeProps = {
  variant?: "icon" | "text" | "full";
  className?: string;
};

const imageSources = {
  icon: { src: "/brand/chill-pros-badge.png", alt: "Chill Pros logo", width: 512, height: 512 },
  full: { src: "/brand/chill-pros-badge.png", alt: "Chill Pros logo", width: 512, height: 512 },
};

export function LogoBadge({ variant = "full", className = "" }: LogoBadgeProps) {
  if (variant === "text") {
    return (
      <div className={`flex flex-col items-center justify-center ${className}`}>
        <Image
          src="/brand/chill-pros-wordmark-chrome.png"
          alt="Chill Pros"
          width={2159}
          height={728}
          priority
          className="h-auto w-full object-contain"
        />
        <p className="font-brand -mt-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#d9fbff] sm:text-xs">Operational Command Center</p>
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
