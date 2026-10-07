"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { completeCustomerProfileAction } from "@/lib/chillbros/customer-account-actions";

const input = "mt-1.5 w-full rounded-xl border border-[#B9CBE3] bg-white px-4 py-3 text-base text-[#0B1220] outline-none placeholder:text-[#8A9AB3] focus:border-[#1F6FEB] focus:ring-2 focus:ring-[#1F6FEB]/25";

export function CustomerWelcomeForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => { setForm({ ...form, [key]: e.target.value }); setError(null); };

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await completeCustomerProfileAction(form);
          if (!result.ok) { setError(result.error); return; }
          router.replace("/my");
          router.refresh();
        });
      }}
    >
      <label className="block"><span className="text-sm font-semibold text-[#3D5170]">Name or business name</span><input value={form.name} onChange={set("name")} autoComplete="organization" placeholder="Riverwalk Grill" className={input} /></label>
      <label className="block"><span className="text-sm font-semibold text-[#3D5170]">Phone</span><input value={form.phone} onChange={set("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="(210) 555-0123" className={input} /></label>
      <label className="block"><span className="text-sm font-semibold text-[#3D5170]">Service address</span><input value={form.address} onChange={set("address")} autoComplete="street-address" placeholder="512 Commerce St, San Antonio, TX" className={input} /></label>
      {error ? <p role="alert" className="text-sm font-semibold text-[#B42318]">{error}</p> : null}
      <button type="submit" disabled={pending} className="flex h-14 w-full items-center justify-center rounded-xl bg-[#1F6FEB] text-lg font-bold text-white shadow-[0_4px_14px_rgba(31,111,235,0.35)] hover:bg-[#1a5fd0] disabled:opacity-60">{pending ? "Saving…" : "Continue"}</button>
    </form>
  );
}
