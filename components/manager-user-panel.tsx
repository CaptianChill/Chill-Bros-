"use client";

import { useMemo, useState } from "react";
import { KeyRound, UserPlus } from "lucide-react";

import type { TechnicianAccount } from "@/lib/mock-data";
import { StatusPill } from "@/components/status-pill";

export function ManagerUserPanel({ accounts }: { accounts: TechnicianAccount[] }) {
  const [team, setTeam] = useState(accounts);
  const [form, setForm] = useState({ name: "", email: "", password: "TEMP-1000" });

  const activeCount = useMemo(() => team.filter((member) => member.status === "Active").length, [team]);

  const toggleStatus = (id: string) => {
    setTeam((current) =>
      current.map((member) =>
        member.id === id
          ? { ...member, status: member.status === "Active" ? "Inactive" : "Active" }
          : member,
      ),
    );
  };

  const resetPassword = (id: string) => {
    setTeam((current) =>
      current.map((member) =>
        member.id === id ? { ...member, tempPassword: `TEMP-${Math.floor(1000 + Math.random() * 9000)}` } : member,
      ),
    );
  };

  const addTechnician = () => {
    if (!form.name || !form.email) {
      return;
    }

    setTeam((current) => [
      {
        id: `tech-${current.length + 1}`,
        name: form.name,
        email: form.email,
        role: "Technician",
        status: "Active",
        assignedJobs: 0,
        lastClockEvent: "Awaiting first dispatch",
        tempPassword: form.password,
      },
      ...current,
    ]);
    setForm({ name: "", email: "", password: "TEMP-1000" });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#00f0f0]/30 bg-black/40 p-4">
        <div>
          <p className="text-sm text-zinc-400">Active credentialed team members</p>
          <p className="text-3xl font-semibold text-white">{activeCount}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="emerald">Role scoped access</StatusPill>
          <StatusPill>Password reset controls</StatusPill>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-[#00f0f0]/30 bg-black/40 p-4 md:grid-cols-[1fr_1fr_auto]">
        <input
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Technician name"
          className="rounded-2xl border border-[#00f0f0]/30 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
        />
        <input
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          placeholder="Email login"
          className="rounded-2xl border border-[#00f0f0]/30 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
        />
        <button
          type="button"
          onClick={addTechnician}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#61f7f7] bg-[#00f0f0]/10 px-4 py-3 text-sm font-medium text-[#defefe] transition hover:bg-[#00f0f0]/20"
        >
          <UserPlus className="h-4 w-4" />
          Add tech
        </button>
      </div>

      <div className="space-y-3">
        {team.map((member) => (
          <div key={member.id} className="grid gap-4 rounded-2xl border border-[#00f0f0]/30 bg-black/40 p-4 lg:grid-cols-[1.2fr_0.8fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-medium text-white">{member.name}</h3>
                <StatusPill tone={member.status === "Active" ? "emerald" : "amber"}>{member.status}</StatusPill>
              </div>
              <p className="mt-1 text-sm text-zinc-400">{member.email}</p>
              <p className="mt-3 text-sm text-zinc-300">{member.role} • {member.assignedJobs} assigned jobs • {member.lastClockEvent}</p>
            </div>
            <div className="space-y-2 rounded-2xl border border-[#00f0f0]/20 bg-zinc-950/80 p-4 text-sm text-zinc-300">
              <p className="text-zinc-500">Temporary password</p>
              <p className="font-mono text-[#bafcfc]">{member.tempPassword}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => resetPassword(member.id)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#00f0f0]/30 px-4 py-3 text-sm text-[#defefe] transition hover:bg-[#00f0f0]/10"
              >
                <KeyRound className="h-4 w-4" />
                Reset password
              </button>
              <button
                type="button"
                onClick={() => toggleStatus(member.id)}
                className="rounded-2xl border border-[#00f0f0]/30 px-4 py-3 text-sm text-white transition hover:bg-[#00f0f0]/10"
              >
                Toggle active
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
