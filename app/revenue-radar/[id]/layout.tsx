import { notFound, redirect } from "next/navigation";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

export default async function RevenueLeadLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data: lead, error } = await createServiceRoleClient()
    .from("chillbros_revenue_prospects")
    .select("id,assigned_salesperson")
    .eq("id", id)
    .maybeSingle();

  if (error || !lead) notFound();
  if (profile.role === "office" && lead.assigned_salesperson !== profile.id) redirect("/revenue-radar");

  return children;
}
