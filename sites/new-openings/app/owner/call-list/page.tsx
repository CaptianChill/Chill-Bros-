import { redirect } from "next/navigation";
import { isOwner } from "@/lib/auth";
import { loadBuyers } from "@/lib/buyers";
import { ownerCalls } from "@/lib/db";
import { CallList } from "./call-list";

export const dynamic = "force-dynamic";

export default async function CallListPage() {
  if (!(await isOwner())) redirect("/owner/login");
  const [buyers, marks] = await Promise.all([loadBuyers(), ownerCalls()]);
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <a href="/owner" className="text-sm text-[#7FD4FF]">← Dashboard</a>
      <h1 className="mt-2 text-3xl font-bold uppercase">Buyer call list</h1>
      <p className="mt-2 text-sm text-[#C9D6E3]">Licensed San Antonio-area contractors from Texas TDLR public records. Call by hand (no auto-dialers or mass texts). Tap a number to call; pick how the call went. It saves to your account, so every phone sees the same list.</p>
      <CallList buyers={buyers} marks={marks} />
      <p className="mt-6 text-xs text-[#8A9BB0]">Source: Texas Department of Licensing and Regulation, data.texas.gov (Bexar, Comal, Guadalupe, Kendall, Medina, Wilson counties). Plumbing, pest control and security licenses are held by other agencies and are not in this list yet.</p>
    </main>
  );
}
