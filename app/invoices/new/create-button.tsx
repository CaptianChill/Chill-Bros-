"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

// The draft autosaver holds the submit for up to 2 seconds while it saves,
// so the button must react on the first tap and swallow repeat taps —
// otherwise it looks dead and a second tap creates a duplicate quote.
export function CreateDocumentButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const [clicked, setClicked] = useState(false);
  const clickedRef = useRef(false);

  // If the page comes back (e.g. with an error) re-arm the button.
  useEffect(() => {
    if (!clicked) return;
    const timer = window.setTimeout(() => { clickedRef.current = false; setClicked(false); }, 20000);
    return () => window.clearTimeout(timer);
  }, [clicked]);

  const busy = clicked || pending;
  return (
    <button
      type="submit"
      aria-busy={busy}
      onClick={(event) => {
        if (clickedRef.current) { event.preventDefault(); return; }
        clickedRef.current = true;
        setClicked(true);
      }}
      className={`min-h-14 w-full rounded-2xl border border-[#8ffafa]/60 bg-[#2d7dff]/20 px-5 py-3 text-lg font-semibold text-white shadow-[0_0_20px_rgba(45,125,255,0.18)] ${busy ? "cursor-wait opacity-70" : ""}`}
    >
      {busy ? `Creating ${label.toLowerCase()}… please wait` : `Create ${label}`}
    </button>
  );
}
