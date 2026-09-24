"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Clock3, LogIn, LogOut } from "lucide-react";

import { clockInResilientAction, clockOutResilientAction } from "@/lib/chillbros/timesheet-operations";

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

function elapsed(fromIso: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 60000));
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

// Clock in / out at the top of the technician's screen, using the existing
// timesheet actions. Breaks and edits stay on the full Clock page.
export function ClockCard({ open }: { open: { id: string; clockInAt: string; location: string | null } | null }) {
  const router = useRouter();
  const [session, setSession] = useState(open);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [session]);

  const clockIn = () => {
    setError(null);
    startTransition(async () => {
      const result = await clockInResilientAction("");
      if (!result.ok) return setError(result.error);
      setSession({ id: result.data.timesheetId, clockInAt: result.data.clockInAt, location: result.data.location });
      setNow(Date.now());
      router.refresh();
    });
  };

  const clockOut = () => {
    if (!session) return;
    setError(null);
    startTransition(async () => {
      // 0 labor lets the action calculate worked hours from the clock times.
      const result = await clockOutResilientAction(session.id, 0, 0);
      if (!result.ok) return setError(result.error);
      setSession(null);
      router.refresh();
    });
  };

  return (
    <section aria-label="Time clock" className="cb-new cb-card p-3.5">
      <div className="flex items-center gap-3">
        <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${session ? "bg-[#1557B0] text-white" : "bg-[#F8FAFD] text-[#1557B0] ring-1 ring-[#C7D3E2]"}`}>
          <Clock3 className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-[#0A1A33]">{session ? "Clocked in" : "Not clocked in"}</p>
          <p className="truncate text-[13px] font-medium text-[#2B3F5C]">
            {session ? `Since ${timeOf(session.clockInAt)} · ${elapsed(session.clockInAt, now)}${session.location ? ` · ${session.location}` : ""}` : "Clock in when you start your day."}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={session ? clockOut : clockIn}
        disabled={pending}
        className={`mt-3 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl text-base font-bold transition disabled:opacity-60 ${
          session ? "border-2 border-[#1557B0] bg-[#F8FAFD] text-[#1557B0]" : "bg-[#1557B0] text-white hover:bg-[#0E3F82]"
        }`}
      >
        {session ? <LogOut className="h-5 w-5" aria-hidden="true" /> : <LogIn className="h-5 w-5" aria-hidden="true" />}
        {pending ? "Saving…" : session ? "Clock out" : "Clock in"}
      </button>
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-[#0B5CD5]">{error}</p> : null}
      <Link href="/timesheet" className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-[#1557B0]">
        Breaks and full timesheet
      </Link>
    </section>
  );
}
