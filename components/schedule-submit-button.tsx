"use client";

import { useFormStatus } from "react-dom";

export function ScheduleSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formNoValidate
      disabled={pending}
      className="min-h-11 w-full touch-manipulation rounded-xl bg-[#1B3FD0] px-4 text-sm font-semibold text-white transition hover:bg-[#1530A8] disabled:cursor-wait disabled:opacity-60 sm:col-span-2"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}
