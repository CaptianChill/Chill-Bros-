import Image from "next/image";

type LogoBadgeProps = {
  variant?: "icon" | "text" | "full";
  className?: string;
};

const sources = {
  icon: { src: "/logo-icon.png", alt: "Chill Bros icon logo", width: 56, height: 56 },
  text: { src: "/logo-text.png", alt: "Chill Bros text logo", width: 240, height: 72 },
  full: { src: "/logo.png", alt: "Chill Bros primary logo", width: 220, height: 220 },
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
