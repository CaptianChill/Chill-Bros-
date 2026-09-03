"use server";

import { redirect } from "next/navigation";

import { createAuthServerClient } from "@/lib/supabase/auth-server";

export async function signInAction(_prevState: { error: string } | null, formData: FormData): Promise<{ error: string } | null> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createAuthServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Incorrect email or password." };
  }

  redirect(next.startsWith("/") ? next : "/");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createAuthServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
