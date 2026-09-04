"use client";

import Link from "next/link";
import { Copy, FileText, Mail, MessageSquareText, UserRound } from "lucide-react";
import { useState } from "react";

export function OfficeDocumentActions({ portalToken, invoiceNumber, customerEmail, customerPhone }: { portalToken: string; invoiceNumber: string; customerEmail: string | null; customerPhone: string | null }) {
  const [message, setMessage] = useState<string | null>(null);
  const portalUrl = () => `${window.location.origin}/portal/${portalToken}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(portalUrl());
      setMessage("Secure customer link copied.");
    } catch {
      setMessage("Copy failed on this device.");
    }
  };
  const email = () => {
    if (!customerEmail) return;
    window.location.href = `mailto:${encodeURIComponent(customerEmail)}?subject=${encodeURIComponent(`Chill Bros ${invoiceNumber}`)}&body=${encodeURIComponent(`Review your Chill Bros estimate/invoice here: ${portalUrl()}`)}`;
  };
  const text = () => {
    if (!customerPhone) return;
    window.location.href = `sms:${customerPhone.replace(/[^+\d]/g, "")}?&body=${encodeURIComponent(`Chill Bros ${invoiceNumber}: ${portalUrl()}`)}`;
  };

  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <Link href={`/portal/${portalToken}`} className="inline-flex items-center gap-1.5 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff]"><UserRound className="h-3.5 w-3.5" />Customer view</Link>
      <Link href={`/portal/${portalToken}/document`} className="inline-flex items-center gap-1.5 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff]"><FileText className="h-3.5 w-3.5" />Document</Link>
      <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff]"><Copy className="h-3.5 w-3.5" />Copy link</button>
      {customerEmail ? <button type="button" onClick={email} className="inline-flex items-center gap-1.5 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff]"><Mail className="h-3.5 w-3.5" />Email</button> : null}
      {customerPhone ? <button type="button" onClick={text} className="inline-flex items-center gap-1.5 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff]"><MessageSquareText className="h-3.5 w-3.5" />Text</button> : null}
    </div>
    {message ? <p className="text-xs text-[#bafcfc]">{message}</p> : null}
  </div>;
}
