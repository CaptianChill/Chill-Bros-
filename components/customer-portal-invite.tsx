"use client";
import { useState, useTransition } from "react";
import { createCustomerInviteAction } from "@/lib/chillbros/customer-invite-actions";

export function CustomerPortalInvite({ customerId }: { customerId: string }) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  function create(sendEmail: boolean) {
    setError(""); setNotice(""); setUrl("");
    startTransition(async () => {
      try {
        const result = await createCustomerInviteAction(customerId, sendEmail);
        if (!result.ok) { setError(result.error); return; }
        setUrl(result.url); setNotice(result.notice);
      } catch { setError("The invitation could not be created. Try again."); }
    });
  }
  return <div className="space-y-3">
    <p className="text-sm text-zinc-300">Connect this customer to their equipment, service history, monthly programs, invoices and quotes. Customers verify their email once and stay signed in for 60 days.</p>
    <div className="flex flex-wrap gap-2"><button disabled={pending} onClick={() => create(true)} className="rounded-xl bg-[#1B3FD0] px-4 py-3 font-semibold text-white disabled:opacity-50">{pending ? "Creating invitation…" : "Email portal invitation"}</button><button disabled={pending} onClick={() => create(false)} className="rounded-xl border border-[#2d7dff]/30 px-4 py-3 text-[#d9fbff] disabled:opacity-50">Create link to share</button></div>
    {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
    {notice ? <p role="status" className="text-sm text-[#d9fbff]">{notice}</p> : null}
    {url ? <div className="space-y-2"><label className="block text-sm text-zinc-300">Private customer invitation<input readOnly value={url} onFocus={(event) => event.target.select()} className="mt-1 w-full rounded-xl border border-[#2d7dff]/30 bg-black p-3 text-white" /></label><button onClick={async () => { try { await navigator.clipboard.writeText(url); setNotice("Invitation link copied."); } catch { setError("Select the link above and copy it manually."); } }} className="rounded-lg border border-[#2d7dff]/30 px-3 py-2 text-sm text-[#d9fbff]">Copy link</button></div> : null}
  </div>;
}
