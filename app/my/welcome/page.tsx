import { redirect } from "next/navigation";

import { Card, CustomerFrame } from "@/components/customer-account/customer-frame";
import { CustomerSignOutButton } from "@/components/customer-account/sign-out-button";
import { CustomerWelcomeForm } from "@/components/customer-account/welcome-form";
import { getCustomerSession } from "@/lib/chillbros/customer-account";

export const dynamic = "force-dynamic";

export default async function CustomerWelcomePage() {
  const session = await getCustomerSession();
  if (!session) redirect("/my/sign-in");
  if (session.customerIds.length) redirect("/my");

  return (
    <CustomerFrame accountName={session.email} right={<CustomerSignOutButton />}>
      <div className="mx-auto max-w-md">
        <h1 className="text-[26px] font-bold">Welcome to Chill Pros</h1>
        <p className="mt-1 mb-5 text-[15px] text-[#3D5170]">
          We didn&apos;t find a record under <span className="font-semibold text-[#0B1220]">{session.email}</span>. Tell us where you need service and you&apos;re all set.
        </p>
        <Card>
          <CustomerWelcomeForm />
        </Card>
        <p className="mt-4 text-center text-sm text-[#3D5170]">
          Already a Chill Pros customer under a different email? Sign out and use that email, or email <a className="font-semibold text-[#1452C2]" href="mailto:chillprostx@gmail.com">chillprostx@gmail.com</a> and we&apos;ll connect it.
        </p>
      </div>
    </CustomerFrame>
  );
}
