import { NextResponse } from "next/server";

import { createSquareCheckout, type SquareCheckoutKind } from "@/lib/chillbros/square-checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Customer taps "Pay by card": create (or reuse) this invoice's Square
// checkout and send them to Square's secure payment page.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const url = new URL(request.url);
  const kind: SquareCheckoutKind = url.searchParams.get("kind") === "down_payment" ? "down_payment" : "invoice";
  const portalUrl = `${url.origin}/portal/${encodeURIComponent(token)}`;
  try {
    const result = await createSquareCheckout(token, kind, portalUrl);
    if (result.ok) return NextResponse.redirect(result.url, 303);
    return NextResponse.redirect(`${portalUrl}?${new URLSearchParams({ payment_error: result.error })}`, 303);
  } catch (error) {
    console.error("[square-checkout] create failed", error);
    return NextResponse.redirect(`${portalUrl}?${new URLSearchParams({ payment_error: "Card checkout is temporarily unavailable. Please try again, or choose another payment option." })}`, 303);
  }
}
