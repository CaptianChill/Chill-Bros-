import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { exchangeMailboxCode, persistMailbox, signedInMailboxBuyer, type Provider } from "@/lib/lead-market/mailbox";
import { unsealCredentials } from "@/lib/lead-market/secrets";
import { marketBase as appBase } from "@/lib/lead-market/config";
export async function GET(request: Request) {
  const jar = await cookies(); const raw = jar.get("cp_market_oauth")?.value;
  jar.set("cp_market_oauth", "", { path: "/api/lead-market/oauth", maxAge: 0 });
  try {
    const b = await signedInMailboxBuyer(); if (!raw) throw new Error("Missing state");
    const state = unsealCredentials<{ buyer: string; provider: Provider; state: string; verifier: string; expires: number }>(b.id, raw);
    const q = new URL(request.url).searchParams; const a = Buffer.from(q.get("state") || ""); const expected = Buffer.from(state.state);
    if (state.buyer !== b.id || state.expires < Date.now() || a.length !== expected.length || !timingSafeEqual(a, expected) || !q.get("code")) throw new Error("Invalid callback state");
    const connection = await exchangeMailboxCode(state.provider, q.get("code")!, state.verifier, `${appBase()}/api/lead-market/oauth/callback`);
    await persistMailbox(b.id, state.provider, connection.email, connection.credentials);
    return NextResponse.redirect(`${appBase()}/leads/mailbox?connected=1`);
  } catch { return NextResponse.redirect(`${appBase()}/leads/mailbox?error=connection`); }
}
