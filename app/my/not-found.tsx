import Link from "next/link";

import { CustomerFrame } from "@/components/customer-account/customer-frame";

export default function CustomerNotFound() {
  return (
    <CustomerFrame>
      <div className="mx-auto max-w-md py-10 text-center">
        <h1 className="text-[26px] font-bold">That page isn&apos;t available</h1>
        <p className="mt-2 text-[15px] text-[#3D5170]">The link may be old or typed incorrectly.</p>
        <Link href="/my" className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-[#1F6FEB] px-6 text-base font-bold text-white hover:bg-[#1a5fd0]">Go to your account</Link>
      </div>
    </CustomerFrame>
  );
}
