"use client";

import { KeyRound, LockKeyhole, LogOut, MessageSquareText, ShieldCheck, Smartphone } from "lucide-react";
import { useState, useTransition } from "react";

import {
  enrollManagerSmsAction,
  sendManagerSmsChallengeAction,
  signOutOtherManagerSessionsAction,
  verifyManagerSmsAction,
} from "@/app/security/mfa/actions";

type SmsChallenge = { factorId: string; challengeId: string; maskedPhone?: string };

export function ManagerMfaPanel({ currentLevel, verifiedFactorId, next }: { currentLevel: string | null; verifiedFactorId: string | null; next: string }) {
  const [pending, startTransition] = useTransition();
  const [phone, setPhone] = useState("");
  const [challenge, setChallenge] = useState<SmsChallenge | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const protectedNow = currentLevel === "aal2";

  const enrollPhone = () => {
    setError(null); setMessage(null); setCode("");
    startTransition(async () => {
      const result = await enrollManagerSmsAction(phone);
      if (!result.ok) { setError(result.error); return; }
      setChallenge(result.data);
      setMessage(`A six-digit verification code was sent to ${result.data.maskedPhone}.`);
    });
  };

  const sendCode = () => {
    if (!verifiedFactorId) return;
    setError(null); setMessage(null); setCode("");
    startTransition(async () => {
      const result = await sendManagerSmsChallengeAction(verifiedFactorId);
      if (!result.ok) { setError(result.error); return; }
      setChallenge({ factorId: verifiedFactorId, challengeId: result.data.challengeId });
      setMessage("A six-digit verification code was sent to your enrolled phone.");
    });
  };

  const verify = () => {
    if (!challenge) return;
    setError(null); setMessage(null);
    startTransition(async () => {
      const result = await verifyManagerSmsAction(challenge.factorId, challenge.challengeId, code);
      if (!result.ok) { setError(result.error); return; }
      window.location.assign(next);
    });
  };

  const revokeOtherSessions = () => {
    setError(null); setMessage(null);
    startTransition(async () => {
      const result = await signOutOtherManagerSessionsAction();
      if (!result.ok) { setError(result.error); return; }
      setMessage("Other manager sessions were revoked. This device stays signed in.");
    });
  };

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
      {message ? <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</p> : null}

      <div className={`rounded-3xl border p-5 ${protectedNow ? "border-emerald-400/35 bg-emerald-400/5" : "border-amber-300/30 bg-amber-300/5"}`}>
        <div className="flex items-start gap-3">
          {protectedNow ? <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-300" /> : <LockKeyhole className="mt-0.5 h-6 w-6 shrink-0 text-amber-200" />}
          <div>
            <h2 className="text-xl font-semibold text-white">{protectedNow ? "Manager verification is active" : "Manager text verification required"}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-300">{protectedNow ? "This manager session has password + phone verification (AAL2)." : "Owner controls stay locked until this session is verified with a code sent by text message."}</p>
          </div>
        </div>
      </div>

      {!protectedNow && !verifiedFactorId && !challenge ? (
        <div className="rounded-3xl border border-[#2d7dff]/30 bg-black/35 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-white"><Smartphone className="h-4 w-4 text-[#8ffafa]" /><h3 className="font-semibold">Set up text-message verification</h3></div>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Enter the mobile number that should receive manager security codes. For U.S. numbers, the area code and 10-digit number are enough.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <input type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value.slice(0, 25))} placeholder="210-555-0123" aria-label="Manager mobile phone number" className="rounded-2xl border border-[#2d7dff]/30 bg-black px-4 py-3 text-white outline-none" />
            <button type="button" onClick={enrollPhone} disabled={pending || phone.trim().length < 10} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/40 bg-[#2d7dff]/10 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"><MessageSquareText className="h-4 w-4" />{pending ? "Sending…" : "Text me a code"}</button>
          </div>
        </div>
      ) : null}

      {!protectedNow && verifiedFactorId && !challenge ? (
        <button type="button" onClick={sendCode} disabled={pending} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/40 bg-[#2d7dff]/10 px-4 py-3 font-medium text-white transition hover:bg-[#2d7dff]/20 disabled:opacity-50">
          <MessageSquareText className="h-4 w-4" />{pending ? "Sending…" : "Text me a verification code"}
        </button>
      ) : null}

      {!protectedNow && challenge ? (
        <div className="rounded-3xl border border-[#2d7dff]/30 bg-black/35 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-white"><KeyRound className="h-4 w-4 text-[#8ffafa]" /><h3 className="font-semibold">Text-message code</h3></div>
          <p className="mt-2 text-sm text-zinc-400">Enter the newest six-digit code sent to {challenge.maskedPhone ?? "your enrolled phone"}. Codes expire, so use the most recent text.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" aria-label="Six-digit text verification code" className="rounded-2xl border border-[#2d7dff]/30 bg-black px-4 py-3 text-center font-mono text-xl tracking-[0.3em] text-white outline-none" />
            <button type="button" onClick={verify} disabled={pending || code.length !== 6} className="rounded-2xl border border-[#8ffafa]/40 bg-[#2d7dff]/10 px-5 py-3 text-sm font-medium text-white disabled:opacity-50">{pending ? "Verifying…" : "Verify & unlock"}</button>
          </div>
          <button type="button" onClick={verifiedFactorId ? sendCode : enrollPhone} disabled={pending} className="mt-3 text-xs text-[#bafcfc] underline decoration-[#2d7dff]/50 underline-offset-4">Send a new code</button>
        </div>
      ) : null}

      {protectedNow ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => window.location.assign(next)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/40 bg-[#2d7dff]/10 px-4 py-3 text-sm font-medium text-white"><ShieldCheck className="h-4 w-4" />Continue to app</button>
          <button type="button" onClick={revokeOtherSessions} disabled={pending} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300/25 px-4 py-3 text-sm text-amber-100 disabled:opacity-50"><LogOut className="h-4 w-4" />Revoke other sessions</button>
        </div>
      ) : null}
    </div>
  );
}
