"use client";

import { useMemo, useState, useTransition } from "react";
import { KeyRound, Mail, UserPlus } from "lucide-react";

import type { StaffAccount, StaffRole } from "@/lib/chillbros/types";
import { addStaffAccountAction, resetStaffPasswordAction, sendStaffPasswordResetEmailAction, toggleStaffStatusAction } from "@/lib/chillbros/mutations";
import { StatusPill } from "@/components/status-pill";

const ROLE_LABELS: Record<StaffRole, string> = {
  manager: "Manager / Owner",
  technician: "Technician",
  office: "Office / Dispatch",
};

const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  manager: "Full owner access, staff administration, reports, pricing, payments, and operational controls.",
  technician: "Assigned field calls, service notes, photos, parts used, estimates, and personal timesheet.",
  office: "Customer intake, scheduling, dispatch, CRM, equipment records, customer documents, workflow monitoring, and personal timesheet.",
};

export function ManagerUserPanel({ accounts }: { accounts: StaffAccount[] }) {
  const [form, setForm] = useState<{ name: string; email: string; role: StaffRole }>({ name: "", email: "", role: "technician" });
  const [revealedPassword, setRevealedPassword] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const activeCount = useMemo(() => accounts.filter((member) => member.status === "active").length, [accounts]);

  const addStaff = () => {
    if (!form.name.trim() || !form.email.trim()) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await addStaffAccountAction({ fullName: form.name, email: form.email, role: form.role });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRevealedPassword({ email: form.email, password: result.data.tempPassword });
      setMessage(`Account created for ${form.email}. A password-setup email was also requested.`);
      setForm({ name: "", email: "", role: "technician" });
    });
  };

  const sendResetEmail = (id: string, email: string) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await sendStaffPasswordResetEmailAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`Password reset email sent to ${email}.`);
    });
  };

  const resetPassword = (id: string, email: string) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await resetStaffPasswordAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRevealedPassword({ email, password: result.data.tempPassword });
      setMessage(`Emergency temporary password created for ${email}.`);
    });
  };

  const toggleStatus = (id: string) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await toggleStaffStatusAction(id);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#2d7dff]/30 bg-black/40 p-4">
        <div>
          <p className="text-sm text-zinc-400">Active credentialed team members</p>
          <p className="text-3xl font-semibold text-white">{activeCount}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="emerald">Email password recovery</StatusPill>
          <StatusPill>Role-based permissions</StatusPill>
        </div>
      </div>

      {error ? <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
      {message ? <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</p> : null}

      {revealedPassword ? (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100">
          <p className="font-medium">Emergency temporary password for {revealedPassword.email}</p>
          <p className="mt-1 font-mono text-lg text-white">{revealedPassword.password}</p>
          <p className="mt-2 text-xs text-zinc-300">Shown once. Email reset is the preferred method; use this only when the employee cannot access email.</p>
          <button type="button" onClick={() => setRevealedPassword(null)} className="mt-3 rounded-xl border border-amber-300/30 px-3 py-1.5 text-xs text-white transition hover:bg-amber-300/10">
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="rounded-2xl border border-[#2d7dff]/30 bg-black/40 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Full name"
            className="rounded-2xl border border-[#2d7dff]/30 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
          />
          <input
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="Email login"
            type="email"
            className="rounded-2xl border border-[#2d7dff]/30 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
          />
          <select
            value={form.role}
            onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as StaffRole }))}
            className="rounded-2xl border border-[#2d7dff]/30 bg-black px-4 py-3 text-sm text-white outline-none"
          >
            <option value="technician">Technician</option>
            <option value="office">Office / Dispatch</option>
            <option value="manager">Manager</option>
          </select>
          <button
            type="button"
            onClick={addStaff}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-3 text-sm font-medium text-[#d9fbff] transition hover:bg-[#2d7dff]/20 disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" />
            Add employee
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-zinc-400"><span className="font-medium text-[#bafcfc]">{ROLE_LABELS[form.role]}:</span> {ROLE_DESCRIPTIONS[form.role]}</p>
        <p className="mt-2 text-xs leading-5 text-zinc-500">New employees receive a secure password-setup email when possible. A one-time temporary password is also shown as an emergency fallback.</p>
      </div>

      <div className="space-y-3">
        {accounts.map((member) => (
          <div key={member.id} className="grid gap-4 rounded-2xl border border-[#2d7dff]/30 bg-black/40 p-4 lg:grid-cols-[1.2fr_0.8fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-medium text-white">{member.fullName}</h3>
                <StatusPill tone={member.status === "active" ? "emerald" : "amber"}>{member.status === "active" ? "Active" : "Inactive"}</StatusPill>
                <StatusPill>{ROLE_LABELS[member.role]}</StatusPill>
              </div>
              <p className="mt-1 text-sm text-zinc-400">{member.email}</p>
              <p className="mt-3 text-sm leading-6 text-zinc-300">{ROLE_DESCRIPTIONS[member.role]}</p>
              <p className="mt-2 text-xs text-zinc-500">{member.assignedJobs} assigned jobs • {member.lastClockEvent ?? "No clock events yet"}</p>
            </div>
            <div className="space-y-2 rounded-2xl border border-[#2d7dff]/20 bg-zinc-950/80 p-4 text-sm text-zinc-300">
              <p className="font-medium text-white">Password access</p>
              <p className="text-zinc-400">Preferred: send a secure reset link so the employee chooses their own password.</p>
              <p className="text-xs text-zinc-500">Passwords are never displayed after they are set.</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => sendResetEmail(member.id, member.email)}
                disabled={pending || member.status !== "active"}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/35 bg-emerald-400/5 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/10 disabled:opacity-40"
              >
                <Mail className="h-4 w-4" />
                Email reset link
              </button>
              <button
                type="button"
                onClick={() => resetPassword(member.id, member.email)}
                disabled={pending}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/30 px-4 py-3 text-sm text-[#d9fbff] transition hover:bg-[#2d7dff]/10 disabled:opacity-60"
              >
                <KeyRound className="h-4 w-4" />
                Emergency temp password
              </button>
              <button
                type="button"
                onClick={() => toggleStatus(member.id)}
                disabled={pending}
                className="rounded-2xl border border-[#2d7dff]/30 px-4 py-3 text-sm text-white transition hover:bg-[#2d7dff]/10 disabled:opacity-60"
              >
                {member.status === "active" ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
