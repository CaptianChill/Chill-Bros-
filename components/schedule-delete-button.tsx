"use client";

import { useFormStatus } from "react-dom";

import { deleteCalendarItemAction } from "@/app/schedule/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-10 w-full touch-manipulation items-center justify-center rounded-xl border border-[#E3261C]/40 bg-white px-3 text-sm font-semibold text-[#B91C12] transition active:scale-[.98] disabled:cursor-wait disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}

export function ScheduleDeleteButton({ jobId, week }: { jobId: string; week: string }) {
  return (
    <form
      action={deleteCalendarItemAction}
      className="flex w-full"
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
