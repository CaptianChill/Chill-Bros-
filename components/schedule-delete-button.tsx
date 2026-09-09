"use client";

import { useFormStatus } from "react-dom";

import { deleteCalendarItemAction } from "@/app/schedule/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="danger-box relative z-20 inline-flex min-h-7 min-w-0 touch-manipulation items-center justify-center px-2 py-1 text-center text-[9px] font-semibold leading-none text-white transition active:scale-[.98] disabled:cursor-wait disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}

export function ScheduleDeleteButton({ jobId, week }: { jobId: string; week: string }) {
  return (
    <form
      action={deleteCalendarItemAction}
      className="relative z-20 flex w-full items-center justify-center"
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
