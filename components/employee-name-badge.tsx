// Shared initials-avatar + bold name treatment for cards whose subject is one
// employee (staff directory, timesheets, pay) — not job/customer cards where
// a technician's name is secondary metadata.
const PALETTE = ["#2d7dff", "#22d3ee", "#a855f7", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#14b8a6"];

export function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

function colorFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

const SIZES = {
  sm: { avatar: "h-8 w-8 text-xs", name: "text-sm" },
  md: { avatar: "h-10 w-10 text-sm", name: "text-lg" },
  lg: { avatar: "h-12 w-12 text-base", name: "text-xl" },
} as const;

export function EmployeeNameBadge({ name, subtitle, size = "md" }: { name: string; subtitle?: string; size?: keyof typeof SIZES }) {
  const color = colorFor(name || "?");
  const dims = SIZES[size];
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={`flex ${dims.avatar} shrink-0 items-center justify-center rounded-full font-bold text-white`}
        style={{ backgroundColor: color, boxShadow: `0 0 0 2px ${color}55` }}
      >
        {initialsFor(name || "?")}
      </span>
      <div className="min-w-0">
        <p className={`${dims.name} truncate font-bold leading-tight text-white`}>{name}</p>
        {subtitle ? <p className="truncate text-xs text-zinc-400">{subtitle}</p> : null}
      </div>
    </div>
  );
}
