import "server-only";
import { lookup } from "node:dns/promises";
import { randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { currentBuyer, marketDb, type Buyer } from "./store";
import { emailAddress, publicIp, introductoryEmail } from "./rules";
import { sealCredentials, unsealCredentials, optOutSignature } from "./secrets";
import { marketBase as appBase } from "./config";

export type Provider = "google" | "microsoft";
export type SmtpCredentials = { host: string; port: number; user: string; password: string };
export type OAuthCredentials = { access_token: string; refresh_token: string; expires_at: number };
export function oauthConfig(provider: Provider) {
  return provider === "google" ? {
    client: process.env.LEAD_MARKET_GOOGLE_CLIENT_ID, secret: process.env.LEAD_MARKET_GOOGLE_CLIENT_SECRET,
    authorize: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token",
    scope: "openid email https://www.googleapis.com/auth/gmail.send",
  } : {
    client: process.env.LEAD_MARKET_MICROSOFT_CLIENT_ID, secret: process.env.LEAD_MARKET_MICROSOFT_CLIENT_SECRET,
    authorize: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", token: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scope: "openid email offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Send",
  };
}
export const oauthReady = (provider: Provider) => Boolean(oauthConfig(provider).client && oauthConfig(provider).secret);
async function providerRequest(url: string, init: RequestInit) {
  const r = await fetch(url, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error("Mailbox provider rejected the request. Reconnect your mailbox or contact its administrator.");
  return r;
}
export async function exchangeMailboxCode(provider: Provider, code: string, verifier: string, redirect: string) {
  const c = oauthConfig(provider); if (!c.client || !c.secret) throw new Error("Provider connection is not configured.");
  const r = await providerRequest(c.token, { method: "POST", body: new URLSearchParams({ client_id: c.client, client_secret: c.secret, grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirect }) });
  const tokens = await r.json();
  if (!tokens.access_token || !tokens.refresh_token || !Number.isFinite(tokens.expires_in)) throw new Error("Provider did not grant renewable mailbox access.");
  const identityUrl = provider === "google" ? "https://openidconnect.googleapis.com/v1/userinfo" : "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName";
  const identity = await (await providerRequest(identityUrl, { headers: { Authorization: `Bearer ${tokens.access_token}` } })).json();
  const email = emailAddress(provider === "google" ? identity.email : identity.mail || identity.userPrincipalName);
  if (!email || (provider === "google" && identity.email_verified !== true)) throw new Error("Provider could not verify the sending email identity.");
  return { email, credentials: { access_token: tokens.access_token, refresh_token: tokens.refresh_token, expires_at: Date.now() + tokens.expires_in * 1000 } satisfies OAuthCredentials };
}
export async function persistMailbox(buyerId: string, provider: string, email: string, credentials: SmtpCredentials | OAuthCredentials) {
  const { error } = await marketDb().from("chillbros_market_mailboxes").upsert({ buyer_id: buyerId, provider, email, encrypted_credentials: sealCredentials(buyerId, credentials), status: "connected", verified_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  if (error) throw new Error("Could not save your mailbox connection.");
}
async function smtpTransport(c: SmtpCredentials) {
  if (!/^[a-z0-9.-]{1,253}$/i.test(c.host) || /(^localhost$|\.(local|internal)$)/i.test(c.host) || ![465, 587].includes(c.port)) throw new Error("Use a public SMTP hostname and TLS port 465 or 587.");
  const addresses = await lookup(c.host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((a) => !publicIp(a.address))) throw new Error("Private or reserved SMTP destinations are not allowed.");
  // Connect to the approved IP directly so DNS cannot rebind between validation and use.
  return nodemailer.createTransport({ host: addresses[0].address, port: c.port, secure: c.port === 465, requireTLS: true,
    tls: { servername: c.host, rejectUnauthorized: true, minVersion: "TLSv1.2" }, auth: { user: c.user, pass: c.password },
    connectionTimeout: 12000, greetingTimeout: 12000, socketTimeout: 15000, disableFileAccess: true, disableUrlAccess: true });
}
export async function connectSmtp(buyer: Buyer, email: string, credentials: SmtpCredentials) {
  if (emailAddress(email) !== buyer.email) throw new Error("For SMTP, use the same verified email used for your buyer sign-in. OAuth connections can authorize another mailbox.");
  if (!credentials.user || !credentials.password || credentials.password.length > 1000) throw new Error("Enter your SMTP username and app password.");
  const transport = await smtpTransport(credentials);
  try { await transport.verify(); } finally { transport.close(); }
  await persistMailbox(buyer.id, "smtp", buyer.email, credentials);
}
async function freshToken(buyerId: string, provider: Provider, encrypted: string) {
  let tokens = unsealCredentials<OAuthCredentials>(buyerId, encrypted);
  if (tokens.expires_at > Date.now() + 120000) return tokens.access_token;
  const c = oauthConfig(provider); if (!c.client || !c.secret) throw new Error("Provider configuration is unavailable.");
  const response = await providerRequest(c.token, { method: "POST", body: new URLSearchParams({ client_id: c.client, client_secret: c.secret, grant_type: "refresh_token", refresh_token: tokens.refresh_token }) });
  const refreshed = await response.json();
  if (!refreshed.access_token || !Number.isFinite(refreshed.expires_in)) throw new Error("Reconnect the mailbox to renew access.");
  tokens = { access_token: refreshed.access_token, refresh_token: refreshed.refresh_token || tokens.refresh_token, expires_at: Date.now() + refreshed.expires_in * 1000 };
  const { error } = await marketDb().from("chillbros_market_mailboxes").update({ encrypted_credentials: sealCredentials(buyerId, tokens), updated_at: new Date().toISOString() }).eq("buyer_id", buyerId).eq("status", "connected");
  if (error) throw new Error("Renewed mailbox credentials could not be saved.");
  return tokens.access_token;
}
function mime(from: string, to: string, subject: string, text: string, unsub?: string) {
  if (!emailAddress(from) || !emailAddress(to)) throw new Error("Invalid mail address.");
  const messageId = `<${randomBytes(18).toString("hex")}@${from.split("@")[1]}>`;
  const body = Buffer.from(text).toString("base64").match(/.{1,76}/g)?.join("\r\n") || "";
  return { messageId, raw: [`From: <${from}>`, `To: <${to}>`, `Subject: =?UTF-8?B?${Buffer.from(subject.replace(/[\r\n]/g, " ")).toString("base64")}?=`, `Date: ${new Date().toUTCString()}`, `Message-ID: ${messageId}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", ...(unsub ? [`List-Unsubscribe: <${unsub}>`, "List-Unsubscribe-Post: List-Unsubscribe=One-Click"] : []), "", body].join("\r\n") };
}
export async function sendBuyerMail(buyer: Buyer, to: string, subject: string, text: string, unsubscribe?: string) {
  const { data: box, error } = await marketDb().from("chillbros_market_mailboxes").select("provider,email,encrypted_credentials,status").eq("buyer_id", buyer.id).single();
  if (error || box?.status !== "connected") throw new Error("Your mailbox is disconnected.");
  if (box.provider === "smtp") {
    const transport = await smtpTransport(unsealCredentials<SmtpCredentials>(buyer.id, box.encrypted_credentials));
    try {
      const sent = await transport.sendMail({ from: { name: buyer.company_name, address: box.email }, to, subject, text, ...(unsubscribe ? { headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}) });
      if (!sent.accepted?.length || sent.rejected?.length) throw new Error("The mail server did not accept the recipient.");
      return sent.messageId;
    } finally { transport.close(); }
  }
  const provider = box.provider as Provider; const token = await freshToken(buyer.id, provider, box.encrypted_credentials);
  const message = mime(box.email, to, subject, text, unsubscribe);
  if (provider === "google") {
    const response = await providerRequest("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw: Buffer.from(message.raw).toString("base64url") }) });
    const accepted = await response.json(); if (!accepted.id) throw new Error("Mail acceptance could not be confirmed.");
    return accepted.id as string;
  }
  if (provider !== "microsoft") throw new Error("Unknown mailbox provider.");
  await providerRequest("https://graph.microsoft.com/v1.0/me/sendMail", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/plain" }, body: Buffer.from(message.raw).toString("base64") });
  return message.messageId;
}
export async function runBuyerOutreach(limit = 10) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const weekday = parts.find((p) => p.type === "weekday")?.value; const hour = Number(parts.find((p) => p.type === "hour")?.value);
  if (["Sat", "Sun"].includes(weekday || "") || hour < 9 || hour >= 17) return { accepted: 0, checked: 0 };
  const db = marketDb();
  const { data: settings, error: se } = await db.from("chillbros_market_settings").select("outreach_enabled").eq("id", 1).single();
  if (se || !settings?.outreach_enabled) return { accepted: 0, checked: 0 };
  const { data: orders, error } = await db.from("chillbros_market_orders").select("id,buyer_id,lead_snapshot,listing_id").eq("status", "delivered").order("mail_checked_at", { nullsFirst: true }).order("id").limit(limit);
  if (error || !orders) throw new Error("Outreach queue is unavailable.");
  let accepted = 0; let checked = 0;
  for (const order of orders) {
    if (checked >= limit) break;
    checked++;
    const marked = await db.from("chillbros_market_orders").update({ mail_checked_at: new Date().toISOString() }).eq("id", order.id);
    if (marked.error) throw new Error("Outreach queue progress could not be saved.");
    const { data: receipt, error: re } = await db.rpc("chillbros_market_reserve_email", { order_input: order.id });
    if (re) throw new Error("Outreach reservation failed; run stopped.");
    if (!receipt) continue;
    const { data: b, error: be } = await db.from("chillbros_market_buyers").select("*").eq("id", order.buyer_id).single();
    if (be || !b) throw new Error("Reserved buyer could not be read; receipt retained for review.");
    const email = String(order.lead_snapshot.contact_email).toLowerCase();
    const unsubscribe = `${appBase()}/api/lead-market/unsubscribe?buyer=${encodeURIComponent(b.id)}&email=${encodeURIComponent(email)}&sig=${optOutSignature(b.id, email)}`;
    const draft = introductoryEmail(b.company_name, String(order.lead_snapshot.service_line).replaceAll("_", " "), b.postal_address, unsubscribe);
    try {
      const id = await sendBuyerMail(b as Buyer, email, draft.subject, draft.text, unsubscribe);
      const saved = await db.from("chillbros_market_mail_log").update({ status: "accepted", provider_message_id: id }).eq("id", receipt);
      if (saved.error) throw new Error("Acceptance receipt could not be saved.");
      accepted++;
    } catch {
      await db.from("chillbros_market_mail_log").update({ status: "uncertain", error: "Delivery acceptance is unconfirmed; inspect the sending mailbox before any manual retry." }).eq("id", receipt);
      break;
    }
  }
  return { accepted, checked };
}
export async function signedInMailboxBuyer() { const b = await currentBuyer(); if (!b || b.status === "suspended") throw new Error("Buyer sign-in required."); return b; }
