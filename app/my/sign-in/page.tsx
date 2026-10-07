import Image from "next/image";
import { redirect } from "next/navigation";

import { CustomerFrame } from "@/components/customer-account/customer-frame";
import { CustomerSignInForm } from "@/components/customer-account/sign-in-form";
import { getCustomerSession } from "@/lib/chillbros/customer-account";

export const dynamic = "force-dynamic";

export default async function CustomerSignInPage() {
  const session = await getCustomerSession();
  if (session) redirect(session.customerIds.length ? "/my" : "/my/welcome");

  return (
    <CustomerFrame>
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="rounded-3xl bg-[#05070A] p-4 shadow-[0_8px_30px_rgba(5,7,10,0.25)]">
            <Image src="/brand/chill-pros-ice-logo.png" alt="Chill Pros" width={900} height={900} priority className="h-40 w-40 object-contain drop-shadow-[0_0_14px_rgba(31,111,235,0.5)] sm:h-48 sm:w-48" />
          </div>
          <h1 className="mt-5 text-[28px] font-bold leading-tight">Your Chill Pros account</h1>
          <p className="mt-2 text-[15px] text-[#3D5170]">Request service, pay invoices, approve estimates, and see your equipment history — all in one place.</p>
        </div>
        <div className="rounded-2xl border border-[#D3E1F2] bg-white p-5 shadow-[0_1px_3px_rgba(5,7,10,0.08)]">
          <CustomerSignInForm />
        </div>
      </div>
    </CustomerFrame>
  );
}
