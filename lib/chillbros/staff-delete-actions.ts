"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/server";
import { getCurrentStaffProfile } from "@/lib/neon/data-api/auth-server";
import { createServiceRoleClient } from "@/lib/neon/data-api/service-client";

const OWNER_EMAIL = "chillprostx@gmail.com";
const OWNER_ID = "8c81f12a-ad86-4ceb-bca1-3924be1cbfec";
type Result = { ok: true } | { ok: false; error: string };
function refresh() { for (const path of ["/owner", "/manager", "/create", "/schedule"]) revalidatePath(path); }

async function owner() {
  const profile = await getCurrentStaffProfile();
  return profile?.role === "manager" && profile.email.trim().toLowerCase() === OWNER_EMAIL ? profile : null;
}

export async function deleteStaffAccountAction(staffId: string): Promise<Result> {
  const profile = await owner();
  if (!profile) return { ok: false, error: "Only the owner can delete employees." };
  if (!staffId || staffId === OWNER_ID || staffId === profile.id) return { ok: false, error: "Your owner account is protected." };
  try {
    const db = createServiceRoleClient();
    const { data: member, error } = await db.from("chillbros_profiles").select("id,email,auth_user_id,status").eq("id", staffId).maybeSingle();
    if (error) return { ok: false, error: `Could not load employee: ${error.message}` };
    if (!member) return { ok: false, error: "Employee no longer exists. Refresh the list." };
    const email = String(member.email ?? "").trim().toLowerCase();
    if (email === OWNER_EMAIL) return { ok: false, error: "Your owner account is protected." };
    if (email.endsWith("@removed.invalid")) return { ok: true };
    if (!email) return { ok: false, error: "Employee email is missing; the login cannot be safely identified." };
    const { data: session } = await auth.getSession();
    if (!session?.user || session.user.email?.toLowerCase() !== OWNER_EMAIL) return { ok: false, error: "Sign in again as the owner before deleting employees." };
    const { data: users, error: lookupError } = await auth.admin.listUsers({ query: { filterField: "email", filterValue: email, filterOperator: "eq", limit: 2 } });
    if (lookupError) return { ok: false, error: lookupError.message || "Could not check employee login." };
    const matches = (users?.users ?? []).filter(user => user.email?.trim().toLowerCase() === email);
    if (matches.length > 1) return { ok: false, error: "Multiple logins match this employee. No account was deleted." };
    const login = matches[0];
    if (login?.id === session.user.id || member.auth_user_id === session.user.id) return { ok: false, error: "This record is linked to the owner. No account was deleted." };
    if (member.auth_user_id && member.auth_user_id !== login?.id) {
      if (login) return { ok: false, error: "The employee login and profile do not match. No account was deleted." };
      const { data: linked, error: linkedError } = await auth.admin.listUsers({ query: { filterField: "id", filterValue: member.auth_user_id, filterOperator: "eq", limit: 2 } });
      if (linkedError || (linked?.users ?? []).length) return { ok: false, error: "The employee login could not be safely matched. No account was deleted." };
      // A verified missing login can be retired even if an old auth link remains.
    }
    // Disable app access first. If the auth service fails, the visible inactive
    // record remains available for the owner to retry without losing history.
    const { data: disabled, error: disableError } = await db.from("chillbros_profiles").update({ status: "inactive" }).eq("id", staffId).eq("email", member.email).select("id").maybeSingle();
    if (disableError || !disabled) return { ok: false, error: disableError?.message || "Employee changed. Refresh and try again." };
    refresh();
    if (login) {
      const { error: removeError } = await auth.admin.removeUser({ userId: login.id });
      if (removeError) return { ok: false, error: `Employee disabled, but login deletion failed: ${removeError.message}. Retry Delete.` };
    }
    // Retain the profile ID and name for job, invoice and payroll history.
    // Free the email so the owner can add a fresh account with the same email.
    const { data: removed, error: archiveError } = await db.from("chillbros_profiles").update({ status: "inactive", auth_user_id: null, email: `${staffId}@removed.invalid`, phone: null }).eq("id", staffId).eq("email", member.email).select("id").maybeSingle();
    refresh();
    if (archiveError || !removed) return { ok: false, error: `Login removed, but the staff list could not be updated: ${archiveError?.message || "record changed"}. Retry Delete.` };
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not delete employee. Please try again." }; }
}

export async function removeAllEmployeesAction(): Promise<{ ok: true; removed: number } | { ok: false; error: string }> {
  const profile = await owner();
  if (!profile) return { ok: false, error: "Only the owner can remove employees." };
  const db = createServiceRoleClient();
  const { data: members, error } = await db.from("chillbros_profiles").select("id,email");
  if (error) return { ok: false, error: `Could not load employees: ${error.message}` };
  let removed = 0;
  const failures: string[] = [];
  for (const member of members ?? []) {
    const email = String(member.email ?? "").trim().toLowerCase();
    if (member.id === OWNER_ID || member.id === profile.id || email === OWNER_EMAIL || email.endsWith("@removed.invalid")) continue;
    const result = await deleteStaffAccountAction(member.id);
    if (result.ok) removed++; else failures.push(`${email}: ${result.error}`);
  }
  refresh();
  return failures.length ? { ok: false, error: `Removed ${removed} employees. Some accounts remain: ${failures.join("; ")}` } : { ok: true, removed };
}
