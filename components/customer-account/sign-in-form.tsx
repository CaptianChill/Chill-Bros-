"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";

import { requestCustomerCodeAction, verifyCustomerCodeAction } from "@/lib/chillbros/customer-account-actions";

const input = "mt-1.5 w-full rounded-xl border border-[#B9CBE3] bg-white px-4 py-3.5 text-lg text-[#0B1220] outline-none placeholder:text-[#8A9AB3] focus:border-[#1F6FEB] focus:ring-2 focus:ring-[#1F6FEB]/25";
const primary = "flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#1F6FEB] text-lg font-bold text-white shadow-[0_4px_14px_rgba(31,111,235,0.35)] transition hover:bg-[#1a5fd0] disabled:opacity-60";

export function CustomerSignInForm({ initialEmail = "" }: { initialEmail?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const codeRef = useRef<HTMLInputElement>(null);

  const sendCode = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await requestCustomerCodeAction(email);
      if (!result.ok) { setError(result.error); return; }
      setEmail(result.data.email);
      setCode("");
      setStep("code");
      setNotice(`We sent a 6-digit code to ${result.data.email}.`);
      setTimeout(() => codeRef.current?.focus(), 50);
    });
  };

  const verify = (value = code) => {
    setError(null);
    startTransition(async () => {
      const result = await verifyCustomerCodeAction(email, value);
      if (!result.ok) { setError(result.error); return; }
      router.replace(result.data.needsProfile ? "/my/welcome" : "/my");
      router.refresh();
    });
  };

  if (step === "email") {
    return (
      <form onSubmit={(e) => { e.preventDefault(); sendCode(); }} className="space-y-4" noValidate>
        <label className="block">
          <span className="text-sm font-semibold text-[#3D5170]">Email address</span>
          <input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} placeholder="you@business.com" className={input} />
        </label>
        {error ? <p role="alert" className="text-sm font-semibold text-[#B42318]">{error}</p> : null}
        <button type="submit" disabled={pending} className={primary}><Mail className="h-5 w-5" aria-hidden="true" />{pending ? "Sending…" : "Email me a code"}</button>
        <p className="text-center text-sm text-[#3D5170]">No password needed. Use the email we have on file for your business to see your history.</p>
      </form>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="space-y-4" noValidate>
      {notice ? <p role="status" className="rounded-xl border border-[#C7D3E2] bg-[#F4F8FD] px-4 py-3 text-sm font-semibold text-[#1F3B63]">{notice} Check spam if you don&apos;t see it.</p> : null}
      <label className="block">
        <span className="text-sm font-semibold text-[#3D5170]">6-digit code</span>
        <input ref={codeRef} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} value={code}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(v);
            setError(null);
            if (v.length === 6 && !pending) verify(v);
          }}
          placeholder="123456" className={`${input} text-center text-2xl font-bold tracking-[0.4em]`} />
      </label>
      {error ? <p role="alert" className="text-sm font-semibold text-[#B42318]">{error}</p> : null}
      <button type="submit" disabled={pending || code.length !== 6} className={primary}>{pending ? "Checking…" : "Sign in"}</button>
      <div className="flex items-center justify-between text-sm font-semibold">
        <button type="button" onClick={() => { setStep("email"); setError(null); setNotice(null); }} className="inline-flex items-center gap-1 text-[#1F3B63]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Change email</button>
        <button type="button" onClick={sendCode} disabled={pending} className="text-[#1452C2] underline-offset-2 hover:underline">Send a new code</button>
      </div>
    </form>
  );
}
