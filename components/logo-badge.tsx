import Image from "next/image";

type LogoBadgeProps = {
  variant?: "icon" | "text" | "full";
  className?: string;
};

const sources = {
  icon: { src: "/logo.png", alt: "Chill Bros neon logo", width: 220, height: 220 },
  text: { src: "/logo.png", alt: "Chill Bros neon logo", width: 220, height: 220 },
  full: { src: "/logo.png", alt: "Chill Bros neon logo", width: 220, height: 220 },
};

export function LogoBadge({ variant = "full", className = "" }: LogoBadgeProps) {
  const image = sources[variant];

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
