import { redirect } from "next/navigation";
import { isOwner } from "@/lib/auth";
import { loadBuyers } from "@/lib/buyers";
import { ownerCalls } from "@/lib/db";
import { CallList } from "./call-list";

export const dynamic = "force-dynamic";

export default async function CallListPage() {
  if (!(await isOwner())) redirect("/owner/login");
  const [{ buyers, failed }, marks] = await Promise.all([loadBuyers(), ownerCalls()]);
  return (
    <main className="site-frame py-8">
      <a href="/owner" className="text-sm text-[#7FD4FF]">← Dashboard</a>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Buyer call list</h1>
      <p className="mt-3 max-w-3xl text-sm text-[#C9D6E3]">Licensed San Antonio-area contractors from Texas state license records. Call by hand (no auto-dialers or mass texts). Tap a number to call; pick how the call went. It saves to your account, so every phone sees the same list.</p>
      {failed.length ? <p className="mt-4 rounded-xl border border-[#FF7A59]/50 p-3 text-sm text-[#FF7A59]">Some state lists didn&apos;t load this time ({failed.join(", ")}). Refresh in a few minutes.</p> : null}
      <CallList buyers={buyers} marks={marks} />
      <p className="mt-6 text-xs text-[#8A9BB0]">Sources: TDLR (electricians, sign companies), Texas State Board of Plumbing Examiners (plumbers), Texas Department of Agriculture (pest control). Bexar, Comal, Guadalupe, Kendall, Medina and Wilson counties. The pest control list has no phone numbers, so tap “Find number”.</p>
    </main>
  );
}
