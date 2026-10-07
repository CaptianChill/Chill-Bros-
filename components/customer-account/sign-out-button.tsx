"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { customerSignOutAction } from "@/lib/chillbros/customer-account-actions";

export function CustomerSignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => { await customerSignOutAction(); router.replace("/my/sign-in"); router.refresh(); })}
      className="mt-1 text-[12px] font-semibold text-white/70 underline-offset-2 hover:text-white hover:underline"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
