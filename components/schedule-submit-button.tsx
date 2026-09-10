"use client";

import { useFormStatus } from "react-dom";

export function ScheduleSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formNoValidate
      disabled={pending}
      className="box hot relative z-20 min-h-10 w-full touch-manipulation rounded-lg px-4 py-2 text-center text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60 sm:col-span-2"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}
