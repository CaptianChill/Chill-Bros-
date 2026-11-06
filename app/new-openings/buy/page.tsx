import { redirect } from "next/navigation";

import { LEADBIZ_PHONE, TRADE_LABEL } from "@/lib/chillbros/leadbiz/buyers";
import { SLUG_TRADE, isSquareCheckoutLink, isTradeSlug, productByKey, shortfallCopy } from "@/lib/chillbros/leadbiz/catalog";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout · San Antonio New Openings", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ product?: string; trade?: string }> };

// Checkout gate: every Buy button lands here first. It only forwards to Square when the
// buyer's trade still has enough open projects (max 3 buyers per trade per project), so
// nobody pays for a list that's already full.
export default async function BuyGate({ searchParams }: Props) {
  const { product: productKey, trade } = await searchParams;
  const product = productByKey(productKey);
  if (!product) return <Notice title="Pick a pack first" body="That pack isn't available. Go back and pick one." />;
  if (!isTradeSlug(trade)) return <Notice title="Pick your trade first" body="Go back, tap your trade (Step 1), then tap Buy again so we can check your trade still has open projects." />;

  let link: string | null = null;
  let onSale = false;
  let open = 0;
  try {
    const db = createServiceRoleClient();
    const [{ data: row }, { data: cap, error }] = await Promise.all([
      db.from("chillbros_leadpack_products").select("square_link,on_sale").eq("key", product.key).maybeSingle(),
      db.rpc("chillbros_leadpack_capacity", { p_trade: trade, p_product: product.key }),
    ]);
    if (error) throw error;
    link = row?.square_link ?? null;
    onSale = Boolean(row?.on_sale);
    open = Number(cap ?? 0);
  } catch {
    return <Notice title="Checkout is busy" body="We couldn't check your trade's list just now. Try again in a minute, or call or text us." />;
  }

  const label = TRADE_LABEL[SLUG_TRADE[trade]].plural;
  if (!onSale || !link || !isSquareCheckoutLink(link)) return <Notice title={`${product.name}: opening soon`} body={`Checkout for this ${product.kind === "subscription" ? "plan" : "pack"} isn't switched on yet. Call or text us and we'll set you up today.`} />;
  if (open < product.projects) return <Notice title={`Not enough open projects for ${label}`} body={shortfallCopy(open, product.projects)} />;
  redirect(link);
}

function Notice({ title, body }: { title: string; body: string }) {
  const digits = LEADBIZ_PHONE.replace(/\D/g, "");
  return (
    <main className="grid min-h-dvh place-items-center bg-[#0B1E33] px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#102A44] p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7FD4FF]">San Antonio New Openings</p>
        <h1 className="mt-2 text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#C9D6E3]">{body}</p>
        <div className="mt-5 flex gap-2">
          <a href="/new-openings" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[#F5C542] font-bold text-[#0B1E33]">Back to packs</a>
          <a href={`sms:${digits}`} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[#7FD4FF]/50 font-bold text-[#7FD4FF]">Text {LEADBIZ_PHONE}</a>
        </div>
      </div>
    </main>
  );
}
