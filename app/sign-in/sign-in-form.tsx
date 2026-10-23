"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { KeyRound, LogIn, Mail } from "lucide-react";

import { pinSignInAction, signInAction, staffCodeAction } from "./actions";

const input = "w-full rounded-2xl border neon-tube bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500";
const submit = "inline-flex w-full items-center justify-center gap-2 rounded-2xl neon-tube bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff] transition hover:bg-[#2d7dff]/20 disabled:opacity-60";

/**
 * Staff sign in with their first and last name and a 4-digit PIN. Email-code
 * sign-in stays as a backup, and the owner still uses a password.
 */
export function SignInForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"pin" | "staff" | "password">("pin");
  if (mode === "pin") return <PinForm next={next} onEmail={() => setMode("staff")} onOwner={() => setMode("password")} />;
  return <EmailCodeForm next={next} mode={mode} setMode={setMode} />;
}

/** Default: type your first and last name and your 4-digit PIN. */
function PinForm({ next, onEmail, onOwner }: { next: string; onEmail: () => void; onOwner: () => void }) {
  const [state, formAction, pending] = useActionState(pinSignInAction, null);
  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <label className="block space-y-2">
          <span className="text-sm text-zinc-300">First and last name</span>
          <input name="name" required autoComplete="name" autoCapitalize="words" defaultValue={state?.name ?? ""} placeholder="Eric Lara" className={input} />
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-zinc-300">4-digit PIN</span>
          <input name="pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required autoComplete="current-password" placeholder="••••" className={`${input} text-center text-2xl tracking-[0.5em]`} />
        </label>
        {state?.error ? <p className="text-sm text-[#ff9b9b]">{state.error}</p> : null}
        <button type="submit" disabled={pending} className={submit}><KeyRound className="h-4 w-4" />{pending ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="text-center text-xs text-zinc-400">This phone stays signed in. Forgot your PIN? Ask Brae for a new one.</p>
      <div className="flex justify-between">
        <button type="button" onClick={onEmail} className="text-xs font-medium text-[#bafcfc] hover:text-white">Sign in with email code</button>
        <button type="button" onClick={onOwner} className="text-xs font-medium text-[#bafcfc] hover:text-white">Owner sign-in</button>
      </div>
    </div>
  );
}

function EmailCodeForm({ next, mode, setMode }: { next: string; mode: "pin" | "staff" | "password"; setMode: (mode: "pin" | "staff" | "password") => void }) {
  const [state, formAction, pending] = useActionState(staffCodeAction, null);
  // Bumped by "Use a different email" so the email step shows again.
  const [shownFor, setShownFor] = useState<typeof state>(null);
  const current = state && state !== shownFor ? state : null;
  const email = state && "email" in state ? state.email ?? "" : "";

  if (mode === "password" || current?.step === "password") {
    return <PasswordForm next={next} email={email} onBack={() => { setMode("pin"); setShownFor(state); }} />;
  }

  if (current?.step === "code") {
    return (
      <div className="space-y-4">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="intent" value="verify" />
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="email" value={current.email} />
          <p className="text-sm text-zinc-300">{current.message ?? `Code sent to ${current.email}.`}</p>
          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">6-digit code</span>
            <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} required autoFocus placeholder="123456" className={`${input} text-center text-2xl tracking-[0.4em]`} />
          </label>
          {current.error ? <p className="text-sm text-[#ff9b9b]">{current.error}</p> : null}
          <button type="submit" disabled={pending} className={submit}><LogIn className="h-4 w-4" />{pending ? "Working…" : "Sign in"}</button>
        </form>
        <form action={formAction}>
          <input type="hidden" name="intent" value="request" />
          <input type="hidden" name="email" value={current.email} />
          <button type="submit" disabled={pending} className="w-full text-center text-xs font-medium text-[#bafcfc] hover:text-white">Send a new code</button>
        </form>
        <button type="button" onClick={() => setShownFor(state)} className="w-full text-center text-xs text-zinc-400 hover:text-white">Use a different email</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="intent" value="request" />
        <label className="block space-y-2">
          <span className="text-sm text-zinc-300">Work email</span>
          <input name="email" type="email" required autoComplete="email" autoCapitalize="none" defaultValue={email} placeholder="you@email.com" className={input} />
        </label>
        {current?.step === "email" && current.error ? <p className="text-sm text-[#ff9b9b]">{current.error}</p> : null}
        <button type="submit" disabled={pending} className={submit}><Mail className="h-4 w-4" />{pending ? "Sending code…" : "Email me a sign-in code"}</button>
      </form>
      <p className="text-center text-xs text-zinc-400">No password needed. We&apos;ll email you a 6-digit code.</p>
      <button type="button" onClick={() => setMode("pin")} className="w-full text-center text-xs font-medium text-[#bafcfc] hover:text-white">Sign in with name + PIN</button>
      <button type="button" onClick={() => setMode("password")} className="w-full text-center text-xs font-medium text-[#bafcfc] hover:text-white">Owner sign-in with password</button>
    </div>
  );
}

function PasswordForm({ next, email, onBack }: { next: string; email: string; onBack: () => void }) {
  const [state, formAction, pending] = useActionState(signInAction, null);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block space-y-2">
        <span className="text-sm text-zinc-300">Email</span>
        <input name="email" type="email" required autoComplete="username" defaultValue={email} className={input} />
      </label>
      <label className="block space-y-2">
        <span className="text-sm text-zinc-300">Password</span>
        <input name="password" type="password" required autoComplete="current-password" autoFocus className={input} />
      </label>
      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="text-xs font-medium text-[#bafcfc] hover:text-white">Staff sign-in</button>
        <Link href="/forgot-password" className="text-xs font-medium text-[#bafcfc] hover:text-white">Forgot password?</Link>
      </div>
      {state?.error ? <p className="text-sm text-[#ff9b9b]">{state.error}</p> : null}
      <button type="submit" disabled={pending} className={submit}><LogIn className="h-4 w-4" />{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
