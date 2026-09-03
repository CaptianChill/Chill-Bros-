"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";

import { updateCustomerAction } from "@/lib/chillbros/operations";
import type { Customer } from "@/lib/chillbros/types";

export function CustomerEditor({ customer }: { customer: Customer }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(customer.name);
  const [address, setAddress] = useState(customer.address ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setError(null); setSaved(false);
    startTransition(async () => {
      const result = await updateCustomerAction({ id: customer.id, name, address, phone, email });
      if (!result.ok) { setError(result.error); return; }
      setSaved(true); router.refresh();
    });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
      <div className="grid gap-2 sm:grid-cols-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" className="rounded-xl border border-[#2d7dff]/15 bg-zinc-950 px-3 py-2 text-sm text-white" /><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="rounded-xl border border-[#2d7dff]/15 bg-zinc-950 px-3 py-2 text-sm text-white" /><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="rounded-xl border border-[#2d7dff]/15 bg-zinc-950 px-3 py-2 text-sm text-white" /><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" className="rounded-xl border border-[#2d7dff]/15 bg-zinc-950 px-3 py-2 text-sm text-white" /></div>
      <div className="rounded-xl border border-[#2d7dff]/10 bg-zinc-950/70 p-3 text-sm text-zinc-300"><p className="mb-2 text-xs uppercase tracking-[0.15em] text-zinc-500">Service history</p>{customer.history.length === 0 ? <p className="text-zinc-500">No service history yet.</p> : <ul className="space-y-1">{customer.history.map((event, index) => <li key={`${event}-${index}`}>{event}</li>)}</ul>}</div>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}{saved ? <p className="text-xs text-emerald-300">Saved.</p> : null}
      <button onClick={save} disabled={pending || !name.trim()} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff] disabled:opacity-50"><Save className="h-3.5 w-3.5" />Save customer</button>
    </div>
  );
}
