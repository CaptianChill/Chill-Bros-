"use client";

import { useState } from "react";

/** Browser local input becomes an explicit instant; the server never guesses a timezone. */
export function OutreachReviewTime({ name, label, className }: { name: string; label: string; className: string }) {
  const [instant, setInstant] = useState("");
  return <label className="block">{label}
    <input className={className} type="datetime-local" onChange={(event) => {
      const date = new Date(event.currentTarget.value);
      setInstant(Number.isFinite(date.getTime()) ? date.toISOString() : "");
    }} />
    <input type="hidden" name={name} value={instant} />
    <span className="text-xs text-zinc-400">Your local time; record when you actually checked it.</span>
  </label>;
}
