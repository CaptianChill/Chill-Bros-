// Varsity chenille-patch lettering, matching the CHILL PROS wordmark:
// each letter cycles red / royal blue / gold, outlined black / white / purple.
// Screen readers read the plain text; the colored letters are decorative.

const PATCHES = ["vl-red", "vl-blue", "vl-gold"] as const;

export function VarsityTitle({ text, fuzz = false, className = "" }: { text: string; fuzz?: boolean; className?: string }) {
  let n = 0;
  return (
    <span className={`varsity${fuzz ? " varsity-fuzz" : ""}${className ? ` ${className}` : ""}`}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {Array.from(text).map((ch, i) => {
          if (!/[A-Za-z0-9]/.test(ch)) return <span key={i} className="vl-plain">{ch}</span>;
          const patch = PATCHES[n++ % PATCHES.length];
          return <span key={i} className={`vl ${patch}`}>{ch}</span>;
        })}
      </span>
    </span>
  );
}
