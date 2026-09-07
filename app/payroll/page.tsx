import Link from "next/link";

const PAYROLL_APP_URL = "https://chill-pros-paystub-7t35dqu0p-chill-pros.vercel.app";

export default function PayrollPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <section className="rounded-2xl border border-[#2d7dff]/25 bg-black/35 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ffafa]/70">Manager tools</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Payroll & Paystubs</h1>
        <p className="mt-3 text-sm leading-6 text-[#d9fbff]/80">
          Open the Chill Pros payroll workspace to create, review, print, and export employee paystubs. Keep payroll documents separate from customer-facing invoices while making them available from the same staff command center.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={PAYROLL_APP_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center rounded-xl border border-[#8ffafa]/60 bg-[#2d7dff]/20 px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2d7dff]/30"
          >
            Open Payroll App
          </a>
          <Link
            href="/timesheet"
            className="inline-flex min-h-11 items-center rounded-xl border border-[#2d7dff]/25 bg-black/35 px-4 py-2.5 text-sm font-semibold text-[#d9fbff] hover:border-[#8ffafa]/35"
          >
            Review Timesheets
          </Link>
        </div>
      </section>
    </main>
  );
}
