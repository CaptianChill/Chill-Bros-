import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type FoldSectionProps = {
  title: string;
  /** Short line under the title while closed, e.g. "2 units" or "$627.50 · awaiting approval". */
  meta?: ReactNode;
  /** Right side of the header, e.g. a status pill. */
  badge?: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  id?: string;
};

/**
 * A tap-to-open section: a compact header row that expands to the full content.
 * Native <details>, so it works without JavaScript and stays keyboard accessible.
 */
export function FoldSection({ title, meta, badge, icon, defaultOpen = false, children, id }: FoldSectionProps) {
  return (
    <details id={id} open={defaultOpen} className="group panel neon-frame rounded-xl">
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-3 px-3.5 py-2.5 [&::-webkit-details-marker]:hidden">
        {icon ? <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#2d7dff]/30 bg-[#2d7dff]/10 text-[#8ffafa]" aria-hidden="true">{icon}</span> : null}
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-[15px] font-semibold leading-tight text-white">{title}</span>
          {meta ? <span className="mt-0.5 block truncate text-xs text-zinc-400">{meta}</span> : null}
        </span>
        {badge ? <span className="shrink-0">{badge}</span> : null}
        <ChevronDown className="h-4 w-4 shrink-0 text-[#bafcfc] transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-[#2d7dff]/15 px-3.5 pb-3.5 pt-3 text-left">{children}</div>
    </details>
  );
}
