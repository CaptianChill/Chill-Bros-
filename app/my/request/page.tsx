import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Card, CustomerFrame } from "@/components/customer-account/customer-frame";
import { CustomerRequestForm } from "@/components/customer-account/request-form";
import { CustomerSignOutButton } from "@/components/customer-account/sign-out-button";
import { getCustomerSession } from "@/lib/chillbros/customer-account";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chill Pros · Request service" };

export default async function CustomerRequestPage({ searchParams }: { searchParams: Promise<{ unit?: string }> }) {
  const session = await getCustomerSession();
  if (!session) redirect("/my/sign-in");
  if (!session.customerIds.length) redirect("/my/welcome");
  const query = await searchParams;

  const s = createServiceRoleClient();
  const [{ data: customers }, { data: equipment }] = await Promise.all([
    s.from("chillbros_customers").select("id,name,address").in("id", session.customerIds).order("name"),
    s.from("chillbros_equipment").select("id,customer_id,asset_tag,equipment_type,manufacturer,model").in("customer_id", session.customerIds).order("created_at", { ascending: true }),
  ]);
  const locations = (customers ?? []).map((c) => ({ id: c.id as string, name: c.name as string, address: (c.address as string | null) ?? null }));
  const units = (equipment ?? []).map((u) => ({
    id: u.id,
    customerId: u.customer_id,
    label: [u.equipment_type || "Equipment", [u.manufacturer, u.model].filter(Boolean).join(" "), u.asset_tag ? `Tag ${u.asset_tag}` : null].filter(Boolean).join(" · "),
  }));

  return (
    <CustomerFrame accountName={locations.length > 1 ? `${locations.length} locations` : locations[0]?.name} right={<CustomerSignOutButton />}>
      <div className="mx-auto max-w-xl">
        <Link href="/my" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-[#1F3B63]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back</Link>
        <h1 className="text-[26px] font-bold">Request service</h1>
        <p className="mt-1 mb-5 text-[15px] text-[#3D5170]">Tell us what&apos;s happening. Our office will confirm a time with you.</p>
        <Card>
          <CustomerRequestForm locations={locations} units={units} initialUnitId={query.unit ?? null} />
        </Card>
      </div>
    </CustomerFrame>
  );
}
