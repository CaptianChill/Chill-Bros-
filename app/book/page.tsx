import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { BookingForm, type SlotOption } from "@/components/autopilot/booking-form";
import { Card, CustomerFrame } from "@/components/customer-account/customer-frame";
import { getAutopilotSettings, loadOpenSlots } from "@/lib/chillbros/autopilot/store";
import { getCustomerSession } from "@/lib/chillbros/customer-account";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chill Pros · Book service", description: "Pick an open time for Chill Pros HVAC, refrigeration, kitchen equipment or hood cleaning service in San Antonio." };

function hourLabel(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const h12 = ((h + 11) % 12) + 1;
  return { text: m ? `${h12}:${String(m).padStart(2, "0")}` : String(h12), ampm: h < 12 ? "am" : "pm" };
}

/** "8–10am", "11am–1pm" */
function timeLabel(start: string, end: string) {
  const a = hourLabel(start);
  const b = hourLabel(end);
  return a.ampm === b.ampm ? `${a.text}–${b.text}${b.ampm}` : `${a.text}${a.ampm}–${b.text}${b.ampm}`;
}

function dayLabel(date: string, index: number) {
  if (index === 0) return "Today";
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
}

export default async function BookPage({ searchParams }: { searchParams: Promise<{ l?: string; p?: string; c?: string }> }) {
  const query = await searchParams;
  const s = createServiceRoleClient();
  const settings = await getAutopilotSettings(s);
  const open = await loadOpenSlots(s, settings);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  const tomorrow = new Date(`${today}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowIso = tomorrow.toISOString().slice(0, 10);
  const slots: SlotOption[] = open.map((slot) => ({
    date: slot.date,
    dayLabel: slot.date === today ? "Today" : slot.date === tomorrowIso ? "Tomorrow" : dayLabel(slot.date, 1),
    window: slot.window,
    timeLabel: timeLabel(slot.start, slot.end),
  }));

  // An inbound lead's private link pre-fills what they already told us.
  let prefill: { name?: string; email?: string; phone?: string; address?: string; problem?: string; propertyType?: "residential" | "commercial" } = {};
  let ref: { kind: "l" | "p" | "c"; value: string } | null = null;
  if (query.l && /^[0-9a-f]{32}$/i.test(query.l)) {
    const { data } = await s.from("chillbros_inbound_leads").select("name,email,phone,address,message,property_type,status").eq("token", query.l).maybeSingle();
    if (data) {
      ref = { kind: "l", value: query.l };
      prefill = { name: data.name ?? "", email: data.email ?? "", phone: data.phone ?? "", address: data.address ?? "", problem: data.message ?? "", propertyType: data.property_type === "commercial" ? "commercial" : data.property_type === "residential" ? "residential" : undefined };
    }
  } else if (query.p && /^[0-9a-f-]{36}$/i.test(query.p)) {
    ref = { kind: "p", value: query.p };
    prefill = { propertyType: "commercial" };
  } else if (query.c && /^[0-9a-f-]{36}$/i.test(query.c)) {
    ref = { kind: "c", value: query.c };
  }

  // A signed-in customer (from their Chill Pros homepage) books with their details
  // already filled in, so the booking matches their existing record by email/phone.
  let accountName: string | null = null;
  const session = !ref ? await getCustomerSession().catch(() => null) : null;
  if (session?.customerIds.length) {
    const { data: rows } = await s.from("chillbros_customers").select("name,email,phone,address").in("id", session.customerIds).order("name").limit(1);
    const c = rows?.[0];
    if (c) {
      accountName = c.name ?? null;
      prefill = { name: c.name ?? "", email: c.email ?? session.email ?? "", phone: c.phone ?? "", address: c.address ?? "", propertyType: "commercial" };
    }
  }

  const fee = settings.residential_service_fee;
  const feeNote = fee ? `Service call ${fee}. Written quote before any repair.` : "Written quote before any repair. Nothing is done without your OK.";

  return (
    <CustomerFrame accountName={accountName}>
      <div className="mx-auto max-w-xl">
        {accountName ? <Link href="/my" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-[#1F3B63]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back</Link> : null}
        <h1 className="text-[26px] font-bold">Book service</h1>
        <p className="mt-1 mb-5 text-[15px] text-[#3D5170]">HVAC, refrigeration, ice machines, kitchen equipment{settings.hood_cleaning_active ? " and vent hood cleaning" : ""} in San Antonio and surrounding areas. Pick an open time below.</p>
        <Card>
          <BookingForm slots={slots} prefill={prefill} refParam={ref} feeNote={feeNote} hoodActive={settings.hood_cleaning_active} />
        </Card>
      </div>
    </CustomerFrame>
  );
}
