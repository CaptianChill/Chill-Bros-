import { UnsubscribeButton } from "@/components/autopilot/unsubscribe-button";
import { Card, CustomerFrame } from "@/components/customer-account/customer-frame";

export const dynamic = "force-dynamic";
export const metadata = { title: "San Antonio New Openings · Unsubscribe", robots: { index: false } };

// Unsubscribe for the lead business's contractor emails (same signed links and suppression list as /u).
export default async function LeadsUnsubscribePage({ searchParams }: { searchParams: Promise<{ c?: string; s?: string }> }) {
  const { c = "", s = "" } = await searchParams;
  return (
    <CustomerFrame>
      <div className="mx-auto max-w-md">
        <Card>
          <h1 className="text-2xl font-bold">Unsubscribe</h1>
          <p className="mt-2 mb-5 text-[15px] text-[#3D5170]">Stop San Antonio New Openings emails to <strong>{c || "this address"}</strong>.</p>
          <UnsubscribeButton contact={c} signature={s} brand="San Antonio New Openings" />
        </Card>
      </div>
    </CustomerFrame>
  );
}
