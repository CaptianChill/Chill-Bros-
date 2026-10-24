import { UnsubscribeButton } from "@/components/autopilot/unsubscribe-button";
import { Card, CustomerFrame } from "@/components/customer-account/customer-frame";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chill Pros · Unsubscribe", robots: { index: false } };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ c?: string; s?: string }> }) {
  const { c = "", s = "" } = await searchParams;
  return (
    <CustomerFrame>
      <div className="mx-auto max-w-md">
        <Card>
          <h1 className="text-2xl font-bold">Unsubscribe</h1>
          <p className="mt-2 mb-5 text-[15px] text-[#3D5170]">Stop Chill Pros marketing emails to <strong>{c || "this address"}</strong>. Service confirmations and invoices for work you booked still arrive.</p>
          <UnsubscribeButton contact={c} signature={s} />
        </Card>
      </div>
    </CustomerFrame>
  );
}
