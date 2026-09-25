import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock3, KeyRound, LogOut, Radar, Search, StickyNote } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { signOutAction } from "@/app/sign-in/actions";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

const ROLE_LABELS = { manager: "Manager", office: "Office / Dispatch", technician: "Technician" } as const;

// Account tab: who is signed in, password, sign out, and the field tools
// that aren't in the technician's tab bar.
export default async function AccountPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  const tools = [
    { href: "/timesheet", label: "Clock in / out", icon: Clock3 },
    { href: "/field-notes", label: "Field Notes", icon: StickyNote },
    { href: "/parts-lookup", label: "Parts Pro", icon: Search },
    ...(profile.role === "technician" ? [{ href: "/revenue-radar/handoffs", label: "Tech Requests", icon: Radar }] : []),
  ];
  const row = "flex min-h-14 items-center gap-3 px-3.5 font-semibold text-[#0A1A33] hover:bg-[#F0F5FC]";

  return (
    <AppShell title="Account" description={profile.fullName}>
      <div className="cb-new space-y-3.5">
        <section className="cb-work-card p-3.5">
          <p className="text-lg font-bold">{profile.fullName}</p>
          <p className="text-sm font-medium text-[#2B3F5C]">{profile.email}</p>
          <p className="mt-1 text-sm font-semibold text-[#1557B0]">{ROLE_LABELS[profile.role]}</p>
        </section>
        <nav aria-label="Account and tools" className="cb-work-card divide-y divide-[#0A1A33]/10 overflow-hidden">
          {tools.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={row}>
              <Icon className="h-5 w-5 text-[#1557B0]" aria-hidden="true" />
              {label}
            </Link>
          ))}
          <Link href="/account/update-password" className={row}>
            <KeyRound className="h-5 w-5 text-[#1557B0]" aria-hidden="true" />
            Change password
          </Link>
        </nav>
        <form action={signOutAction}>
          <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#1557B0] bg-white font-semibold text-[#1557B0]">
            <LogOut className="h-5 w-5" aria-hidden="true" />
            Sign out
          </button>
        </form>
      </div>
    </AppShell>
  );
}
