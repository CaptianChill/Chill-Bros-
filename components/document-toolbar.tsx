"use client";

import { ArrowLeft, Copy, Mail, Printer, Share2 } from "lucide-react";
import { useState } from "react";

export function DocumentToolbar({ invoiceNumber, returnHref }: { invoiceNumber: string; returnHref: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const url = () => window.location.href;
  const goBack = () => {
    try {
      const referrer = document.referrer;
      const sameOrigin = referrer ? new URL(referrer).origin === window.location.origin : false;
      if (sameOrigin && window.history.length > 1) {
        window.history.back();
        return;
      }
    } catch {
      // Fall through to the explicit estimate route.
    }
    window.location.assign(returnHref);
  };
  const copy = async () => { try { await navigator.clipboard.writeText(url()); setMessage("Document link copied."); } catch { setMessage("Copy failed on this device."); } };
  const email = () => { window.location.href = `mailto:?subject=${encodeURIComponent(`Chill Bros ${invoiceNumber}`)}&body=${encodeURIComponent(`View your Chill Bros document here: ${url()}`)}`; };
  const share = async () => { try { if (navigator.share) await navigator.share({ title: `Chill Bros ${invoiceNumber}`, url: url() }); else await copy(); } catch { /* share sheet dismissed */ } };
  return <div className="print:hidden sticky top-2 z-20 mb-4 rounded-2xl border border-[#2d7dff]/30 bg-[#020407]/95 p-2 shadow-lg backdrop-blur"><div className="flex flex-wrap items-center justify-center gap-2"><button type="button" onClick={goBack} className="inline-flex items-center gap-1.5 rounded-xl border border-[#8ffafa]/35 bg-[#2d7dff]/10 px-3 py-2 text-xs font-medium text-[#d9fbff]"><ArrowLeft className="h-4 w-4" />Back to estimate</button><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-xs text-white"><Printer className="h-4 w-4" />Print / PDF</button><button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-xs text-white"><Copy className="h-4 w-4" />Copy link</button><button type="button" onClick={email} className="inline-flex items-center gap-1.5 rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-xs text-white"><Mail className="h-4 w-4" />Email</button><button type="button" onClick={share} className="inline-flex items-center gap-1.5 rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-xs text-white"><Share2 className="h-4 w-4" />Share</button></div>{message ? <p className="mt-2 text-center text-xs text-[#bafcfc]">{message}</p> : null}</div>;
}
