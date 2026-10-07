import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Check, Wrench } from "lucide-react";

import { Card, CustomerFrame, shortDate } from "@/components/customer-account/customer-frame";
import { CustomerSignOutButton } from "@/components/customer-account/sign-out-button";
import { getCustomerSession } from "@/lib/chillbros/customer-account";
import { getCustomerUnit } from "@/lib/chillbros/customer-home-queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chill Pros · Equipment" };

export default async function CustomerEquipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCustomerSession();
  if (!session) redirect("/my/sign-in");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getCustomerUnit(session.customerIds, id);
  if (!data) notFound();
  const { unit, visits } = data;
  const facts = [
    ["Make", unit.manufacturer],
    ["Model", unit.model],
    ["Serial", unit.serial_number],
    ["Refrigerant", unit.refrigerant],
    ["Asset tag", unit.asset_tag],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <CustomerFrame right={<CustomerSignOutButton />}>
      <div className="mx-auto max-w-2xl">
        <Link href="/my" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-[#1F3B63]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back</Link>
        <h1 className="text-[26px] font-bold">{unit.equipment_type || "Equipment"}</h1>
        <p className="mt-1 text-[15px] text-[#3D5170]">{[unit.manufacturer, unit.model].filter(Boolean).join(" ")}</p>

        <Link href={`/my/request?unit=${unit.id}`} className="mt-4 mb-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#1F6FEB] text-lg font-bold text-white shadow-[0_4px_14px_rgba(31,111,235,0.35)] hover:bg-[#1a5fd0]">
          <Wrench className="h-5 w-5" aria-hidden="true" />Report a problem with this unit
        </Link>

        <div className="grid gap-4">
          {facts.length ? (
            <Card title="Details">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                {facts.map(([k, v]) => (
                  <div key={k}><dt className="text-xs font-semibold uppercase tracking-wide text-[#5B6B82]">{k}</dt><dd className="text-[15px] font-semibold break-words">{v}</dd></div>
                ))}
              </dl>
            </Card>
          ) : null}

          <Card title="Service history">
            {visits.length ? (
              <ul>
                {visits.map((v) => (
                  <li key={v.id} className="flex gap-3 border-t border-[#E6EEF8] py-3 first:border-t-0 first:pt-0">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${v.done ? "bg-[#EAF3FF] text-[#1F6FEB]" : "bg-[#FFF4DC] text-[#7A4A00]"}`}>
                      {v.done ? <Check className="h-5 w-5" aria-hidden="true" /> : <Wrench className="h-5 w-5" aria-hidden="true" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold">{v.title}</p>
                      <p className="text-sm text-[#3D5170]">{[shortDate(v.date), v.jobNumber, v.done ? null : v.statusLabel].filter(Boolean).join(" · ")}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] text-[#3D5170]">No visits on record for this unit yet.</p>
            )}
          </Card>
        </div>
      </div>
    </CustomerFrame>
  );
}
