import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { signedInMailboxBuyer, oauthConfig, oauthReady, type Provider } from "@/lib/lead-market/mailbox";
import { sealCredentials } from "@/lib/lead-market/secrets";
import { marketBase as appBase } from "@/lib/lead-market/config";
export async function GET(request: Request) {
  const b = await signedInMailboxBuyer(); const provider = new URL(request.url).searchParams.get("provider") as Provider;
  if (!["google", "microsoft"].includes(provider) || !oauthReady(provider)) return new Response("Provider is not configured", { status: 503 });
  const c = oauthConfig(provider); const state = randomBytes(32).toString("base64url"); const verifier = randomBytes(48).toString("base64url");
  (await cookies()).set("cp_market_oauth", sealCredentials(b.id, { buyer: b.id, provider, state, verifier, expires: Date.now() + 600000 }), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/lead-market/oauth", maxAge: 600 });
  const redirect = `${appBase()}/api/lead-market/oauth/callback`;
  const u = new URL(c.authorize); u.search = new URLSearchParams({ client_id: c.client!, response_type: "code", scope: c.scope, redirect_uri: redirect, state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", ...(provider === "google" ? { access_type: "offline", prompt: "consent" } : {}) }).toString();
  return NextResponse.redirect(u);
}
