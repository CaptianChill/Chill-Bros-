"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { StaffAccount, StaffRole } from "@/lib/chillbros/types";
import { addStaffAccountAction, enableEmailSignInForAllAction, resetStaffPasswordAction, setStaffPinAction, toggleStaffStatusAction } from "@/lib/chillbros/mutations";
import { deleteStaffAccountAction, removeAllEmployeesAction } from "@/lib/chillbros/staff-delete-actions";
import { EmployeeNameBadge } from "@/components/employee-name-badge";

const OWNER_EMAIL = "chillprostx@gmail.com";
const OWNER_ID = "8c81f12a-ad86-4ceb-bca1-3924be1cbfec";
const field = "min-h-12 w-full rounded-xl border border-[#2d7dff]/30 bg-black px-3 py-2 text-white";
const button = "min-h-12 rounded-xl border border-[#2d7dff]/40 px-4 py-2 text-white disabled:opacity-50";
const isOwner = (member: StaffAccount) => member.id === OWNER_ID || member.email.trim().toLowerCase() === OWNER_EMAIL;

export function ManagerUserPanel({ accounts, canManageCredentials }: { accounts: StaffAccount[]; canManageCredentials: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const employees = accounts.filter(member => !isOwner(member));

  function run(task: () => Promise<void>) {
    setError(""); setMessage("");
    startTransition(async () => {
      try { await task(); router.refresh(); }
      catch (error) { setError(error instanceof Error ? error.message : "Could not save. Please try again."); }
    });
  }

  return <div className="space-y-5">
    <p className="text-sm text-zinc-300">{employees.length} employees. Your owner account is protected. Deleted employees lose login access; past job, invoice, and time records are kept.</p>
    {error ? <p role="alert" className="rounded-xl bg-rose-500/10 p-4 text-rose-200">{error}</p> : null}
    {message ? <p role="status" className="rounded-xl bg-emerald-500/10 p-4 text-emerald-200">{message}</p> : null}

    {canManageCredentials ? <form data-no-draft className="space-y-3 rounded-2xl border border-[#2d7dff]/30 p-4" onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget; const fd = new FormData(form);
      run(async () => {
        const email = String(fd.get("email") ?? "");
        const result = await addStaffAccountAction({ fullName: String(fd.get("name") ?? ""), email, role: String(fd.get("role")) as StaffRole });
        if (!result.ok) { setError(result.error); return; }
        setMessage(`Employee added. Tap "New PIN" next to their name to give them a PIN — they sign in with their name and that PIN.`); form.reset();
      });
    }}>
      <h3 className="text-lg font-semibold">Add employee</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>Name<input required name="name" maxLength={200} className={field} /></label>
        <label>Email<input required name="email" type="email" autoComplete="off" className={field} /></label>
        <label>Role<select name="role" defaultValue="technician" className={field}><option value="technician">Technician</option><option value="office">Office / Dispatch</option><option value="salesperson">Salesperson (commission)</option><option value="manager">Manager</option></select></label>
      </div>
      <p className="text-sm text-zinc-400">No password needed. After adding, tap &quot;New PIN&quot; — employees sign in with their first and last name and that 4-digit PIN.</p>
      <button disabled={pending} className={button}>Add employee</button>
    </form> : <p>Only the owner can add employees, change passwords, or delete accounts.</p>}

    {accounts.map(member => <section key={member.id} className="space-y-3 rounded-2xl border border-[#2d7dff]/30 p-4">
      <EmployeeNameBadge name={member.fullName} subtitle={isOwner(member) ? "Owner (protected)" : member.role} size="lg" />
      <p className="text-sm">{member.email} · {member.status}</p>
      {isOwner(member) ? <Link className="underline" href="/account/update-password">Change my owner password</Link> : <>
        <div className="flex flex-wrap gap-2">
          {canManageCredentials ? <button disabled={pending || member.status !== "active"} className={button} onClick={() => run(async () => { const result = await setStaffPinAction(member.id); if (!result.ok) { setError(result.error); return; } setMessage(`New PIN for ${result.data.fullName}: ${result.data.pin}. They sign in at chill-bros.vercel.app/sign-in by typing "${result.data.fullName}" and this PIN. Their old PIN or email code stops working.`); })}>New PIN</button> : null}
          {canManageCredentials ? <button disabled={pending || member.status !== "active"} className={button} onClick={() => run(async () => { const result = await resetStaffPasswordAction(member.id); if (!result.ok) { setError(result.error); return; } setMessage(`Email sign-in is on for ${member.fullName}. They sign in with ${member.email} and the code we email them.`); })}>Turn on email sign-in</button> : null}
          <button disabled={pending} className={button} onClick={() => run(async () => { const result = await toggleStaffStatusAction(member.id); if (!result.ok) setError(result.error); else setMessage(member.status === "active" ? "Employee deactivated." : "Employee activated."); })}>{member.status === "active" ? "Deactivate" : "Activate"}</button>
          {canManageCredentials ? <button disabled={pending} className={button} onClick={() => setConfirmDelete(member.id)}>Delete employee</button> : null}
        </div>
        {confirmDelete === member.id ? <div className="space-y-2"><p>Delete {member.fullName}&apos;s login and remove them from the staff list?</p><button disabled={pending} className={button} onClick={() => run(async () => { const result = await deleteStaffAccountAction(member.id); if (!result.ok) { setError(result.error); return; } setConfirmDelete(null); setMessage("Employee deleted. Their previous work records are preserved."); })}>Confirm delete</button><button className={button} onClick={() => setConfirmDelete(null)}>Cancel</button></div> : null}
      </>}
    </section>)}
    {canManageCredentials && employees.length > 0 ? <section className="space-y-3 rounded-xl border border-[#2d7dff]/30 p-4"><h3 className="font-semibold">Email sign-in for everyone</h3><p className="text-sm">Switch every active employee to email-code sign-in. Their old passwords stop working.</p><button disabled={pending} className={button} onClick={() => run(async () => { const result = await enableEmailSignInForAllAction(); if (!result.ok) { setError(result.error); return; } setMessage(`Email sign-in is on for ${result.data.enabled} employee${result.data.enabled === 1 ? "" : "s"}.`); if (result.data.failed.length) setError(`Couldn't switch: ${result.data.failed.join("; ")}`); })}>Turn on email sign-in for everyone</button></section> : null}
    {canManageCredentials && employees.length > 0 ? <section className="space-y-3 rounded-xl border border-rose-400/30 p-4"><h3 className="font-semibold">Start with a fresh employee list</h3><p className="text-sm">Remove all {employees.length} employees and their logins. Keep your owner account and business history.</p>{confirmAll ? <><button disabled={pending} className={button} onClick={() => run(async () => { const result = await removeAllEmployeesAction(); if (!result.ok) { setError(result.error); return; } setConfirmAll(false); setMessage(`Removed ${result.removed} employees. Your owner account is unchanged. Add your new employees above.`); })}>Confirm remove all employees</button><button className={button} onClick={() => setConfirmAll(false)}>Cancel</button></> : <button disabled={pending} className={button} onClick={() => setConfirmAll(true)}>Remove all employees except owner</button>}</section> : null}
  </div>;
}
