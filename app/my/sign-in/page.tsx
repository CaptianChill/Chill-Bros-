import Image from "next/image";
import { redirect } from "next/navigation";

import { CustomerFrame } from "@/components/customer-account/customer-frame";
import { CustomerSignInForm } from "@/components/customer-account/sign-in-form";
import { getCustomerSession, linkFromTarget, resolveLinkTarget } from "@/lib/chillbros/customer-account";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ invite?: string; invoice?: string }> };

export default async function CustomerSignInPage({ searchParams }: Props) {
  const query = await searchParams;
  const link = query.invite ? { kind: "invite", token: query.invite } : query.invoice ? { kind: "invoice", token: query.invoice } : null;
  const [session, target] = await Promise.all([getCustomerSession(), link ? resolveLinkTarget(link.kind, link.token) : null]);
  if (session) {
    // Already signed in: a personal link just connects that business too.
    if (target && !session.customerIds.includes(target.customerId)) await linkFromTarget(session.accountId, session.email, target);
    redirect(session.customerIds.length || target ? "/my" : "/my/welcome");
  }

  return (
    <CustomerFrame>
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="rounded-3xl bg-[#05070A] p-4 shadow-[0_8px_30px_rgba(5,7,10,0.25)]">
            <Image src="/brand/chill-pros-ice-logo.png" alt="Chill Pros" width={900} height={900} priority sizes="192px" className="h-40 w-40 object-contain drop-shadow-[0_0_14px_rgba(31,111,235,0.5)] sm:h-48 sm:w-48" />
          </div>
          <h1 className="mt-5 text-[28px] font-bold leading-tight">Your Chill Pros account</h1>
          <p className="mt-2 text-[15px] text-[#3D5170]">Request service, pay invoices, approve estimates, and see your equipment history — all in one place.</p>
        </div>
        <div className="rounded-2xl border border-[#D3E1F2] bg-white p-5 shadow-[0_1px_3px_rgba(5,7,10,0.08)]">
          {link && !target ? (
            <p role="alert" className="mb-4 rounded-xl border border-[#F3D48B] bg-[#FFF8E8] px-4 py-3 text-sm font-semibold text-[#7A4A00]">That sign-up link has expired. You can still sign in below, or ask Chill Pros for a new link.</p>
          ) : null}
          {target ? (
            <p className="mb-4 rounded-xl border border-[#C7D3E2] bg-[#F4F8FD] px-4 py-3 text-sm text-[#1F3B63]">Setting up the account for <span className="font-bold">{target.customerName}</span>. Your service history will be connected automatically.</p>
          ) : null}
          <CustomerSignInForm link={target && link ? link : null} />
        </div>
      </div>
    </CustomerFrame>
  );
}
