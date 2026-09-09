"use client";

import { useFormStatus } from "react-dom";

import { deleteCalendarItemAction } from "@/app/schedule/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="relative z-20 min-h-9 w-full touch-manipulation rounded-lg border border-rose-500/45 bg-rose-500/10 px-2.5 py-2 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-500/20 active:scale-[.98] disabled:cursor-wait disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}

export function ScheduleDeleteButton({ jobId, week }: { jobId: string; week: string }) {
  return (
    <form
      action={deleteCalendarItemAction}
      className="relative z-20 w-full"
      onSubmit={(event) => {
        if (!window.confirm("Delete this scheduled item?")) event.preventDefault();
      }}
    >
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="week" value={week} />
      <SubmitButton />
    </form>
  );
}
