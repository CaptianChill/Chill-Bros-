/** Compatibility export: existing callers now receive clean, readable text. */
export function VarsityTitle({ text, className = "" }: { text: string; fuzz?: boolean; className?: string }) {
  return <span className={className}>{text}</span>;
}
