import { PlatformLogo } from "@/components/platform-logo";

/** Legacy variants all display the approved Texas logo. */
export function LogoBadge({ className = "" }: { variant?: "icon" | "text" | "full"; className?: string }) {
  return <PlatformLogo priority className={className} />;
}
