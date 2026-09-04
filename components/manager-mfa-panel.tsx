"use client";

import Image from "next/image";
import { KeyRound, LockKeyhole, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { useState, useTransition } from "react";

import { enrollManagerMfaAction, signOutOtherManagerSessionsAction, verifyManagerMfaAction } from "@/app/security/mfa/actions";

type Enrollment = { factorId: string; qrCode: string; secret: string };

export function ManagerMfaPanel({ currentLevel, verifiedFactorId, next }: { currentLevel: string | null; verifiedFactorId: string | null; next: string }) {
  const [pending, startTransition] = useTransition();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const factorId = verifiedFactorId ?? enrollment?.factorId ?? null;
  const protectedNow = currentLevel === "aal2";

  const startEnrollment = () => {
    setError(null); setMessage(null);
    startTransition(async () => {
      const result = await enrollManagerMfaAction();
      if (!result.ok) { setError(result.error); return; }
      setEnrollment(result.data);
      setMessage("Authenticator setup started. Scan the QR code, then enter the six-digit code.");
    });
  };

  const verify = () => {
    if (!factorId) return;
    setError(null); setMessage(null);
    startTransition(async () => {
      const result = await verifyManagerMfaAction(factorId, code);
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
            <h2 className="text-xl font-semibold text-white">{protectedNow ? "Manager MFA is active" : "Manager MFA required"}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-300">{protectedNow ? "This manager session has password + authenticator verification (AAL2)." : "Owner controls stay locked until this session is verified with an authenticator app."}</p>
          </div>
        </div>
      </div>

      {!protectedNow && !verifiedFactorId && !enrollment ? (
        <button type="button" onClick={startEnrollment} disabled={pending} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/40 bg-[#2d7dff]/10 px-4 py-3 font-medium text-white transition hover:bg-[#2d7dff]/20 disabled:opacity-50">
          <Smartphone className="h-4 w-4" />{pending ? "Starting…" : "Set up authenticator app"}
        </button>
      ) : null}

      {enrollment ? (
        <div className="grid gap-4 rounded-3xl border border-[#2d7dff]/30 bg-black/35 p-4 sm:grid-cols-[240px_1fr] sm:p-5">
          <div className="mx-auto flex w-full max-w-[240px] items-center justify-center rounded-2xl bg-white p-3">
            <Image src={enrollment.qrCode} alt="Chill Bros manager MFA QR code" width={220} height={220} unoptimized className="h-auto w-full" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white">Scan with an authenticator app</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Use Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP app. The code changes about every 30 seconds.</p>
            <div className="mt-4 rounded-2xl border border-[#2d7dff]/20 bg-black/70 p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Manual setup secret</p>
              <p className="mt-1 break-all font-mono text-sm text-[#d9fbff]">{enrollment.secret}</p>
            </div>
          </div>
        </div>
      ) : null}

      {!protectedNow && factorId ? (
        <div className="rounded-3xl border border-[#2d7dff]/30 bg-black/35 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-white"><KeyRound className="h-4 w-4 text-[#8ffafa]" /><h3 className="font-semibold">Authenticator code</h3></div>
          <p className="mt-2 text-sm text-zinc-400">Enter the current six-digit code. Verification of a newly enrolled factor also revokes the account&apos;s other sessions.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" aria-label="Six-digit authenticator code" className="rounded-2xl border border-[#2d7dff]/30 bg-black px-4 py-3 text-center font-mono text-xl tracking-[0.3em] text-white outline-none" />
            <button type="button" onClick={verify} disabled={pending || code.length !== 6} className="rounded-2xl border border-[#8ffafa]/40 bg-[#2d7dff]/10 px-5 py-3 text-sm font-medium text-white disabled:opacity-50">{pending ? "Verifying…" : "Verify & unlock"}</button>
          </div>
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
