"use server";
import { revalidatePath } from "next/cache";
import { connectSmtp, sendBuyerMail, signedInMailboxBuyer } from "@/lib/lead-market/mailbox";
import { marketDb } from "@/lib/lead-market/store";
import { cleanText, emailAddress } from "@/lib/lead-market/rules";
import type { MarketResult } from "@/components/lead-market/form";
async function run(action: () => Promise<void>): Promise<MarketResult> {
  try { await action(); revalidatePath("/leads/mailbox"); return { ok: true, notice: "Mailbox settings updated." }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Mailbox request failed." }; }
}
export async function saveSmtp(f: FormData) { return run(async () => {
  const b = await signedInMailboxBuyer(); const email = emailAddress(f.get("email"));
  if (!email) throw new Error("Enter the sending email.");
  await connectSmtp(b, email, { host: cleanText(f.get("host"), 253), port: Number(f.get("port")), user: cleanText(f.get("user"), 320), password: String(f.get("password") || "") });
}); }
export async function disconnectMailbox() { return run(async () => {
  const b = await signedInMailboxBuyer(); const db = marketDb();
  const { error } = await db.from("chillbros_market_buyers").update({ automation_enabled: false }).eq("id", b.id);
  if (error) throw new Error("Could not stop sending. Please retry.");
  const r = await db.from("chillbros_market_mailboxes").update({ status: "disconnected", encrypted_credentials: "disconnected", updated_at: new Date().toISOString() }).eq("buyer_id", b.id);
  if (r.error) throw new Error("Sending is disabled, but credential removal needs support review.");
}); }
export async function testMailbox() { return run(async () => {
  const b = await signedInMailboxBuyer();
  await sendBuyerMail(b, b.email, "Your marketplace mailbox connection test", "You requested this connection test from your buyer account. This is not a lead outreach message. Receiving this message confirms this test reached your inbox; the platform only records provider acceptance.");
}); }
