import { NextResponse } from "next/server";

// Retire new Stripe sessions even when old credentials/settings still exist.
// The webhook remains available to reconcile previously created payments.
export async function POST() {
  return NextResponse.json({ error: "Stripe checkout is no longer available. Reopen your invoice and select Pay with Square." }, { status: 410 });
}
