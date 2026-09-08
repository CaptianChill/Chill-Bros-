"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock3, FilePenLine, Trash2 } from "lucide-react";

import { deleteFormDraft, readFormDrafts, type FormDraft, withDraftParam } from "@/lib/chillbros/form-drafts";

export function OpenFormDrafts({ customerId }: { customerId: string }) {
  const [drafts, setDrafts] = useState<FormDraft[]>([]);

  useEffect(() => {
    const refresh = () => setDrafts(readFormDrafts().filter((draft) => draft.customerId === customerId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("chillbros:drafts-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("chillbros:drafts-changed", refresh);
    };
  }, [customerId]);

  if (!drafts.length) return <p className="text-sm text-zinc-500">No device-saved forms are waiting for this customer.</p>;

  return <div className="space-y-2">
    {drafts.map((draft) => <div key={draft.id} className="rounded-xl border border-[#2d7dff]/15 bg-black/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-white"><FilePenLine className="h-4 w-4 text-[#8ffafa]" />{draft.label}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500"><Clock3 className="h-3.5 w-3.5" />Saved {new Date(draft.updatedAt).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} CT</p>
        </div>
        <div className="flex gap-2">
          <Link href={withDraftParam(draft.path, draft.id)} className="rounded-lg border border-[#8ffafa]/35 bg-[#2d7dff]/10 px-3 py-2 text-xs font-semibold text-[#d9fbff]">Edit / Continue</Link>
          <button type="button" onClick={() => { deleteFormDraft(draft.id); setDrafts((current) => current.filter((item) => item.id !== draft.id)); }} className="inline-flex items-center rounded-lg border border-rose-500/25 px-2.5 py-2 text-rose-200" aria-label={`Delete ${draft.label} draft`}><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>)}
    <p className="text-[11px] leading-5 text-zinc-600">These quick drafts are stored on this device for crash/refresh protection. Created quotes, invoices, calls, and agreements remain in the Chill Bros database and appear above.</p>
  </div>;
}
