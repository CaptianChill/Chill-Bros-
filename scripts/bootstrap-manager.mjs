#!/usr/bin/env node
// One-time setup: creates the first manager account so someone can log in
// and use the in-app "Add tech" panel for everyone after that.
//
// Run locally (never in Vercel, never with the key pasted into chat):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/bootstrap-manager.mjs "Full Name" "owner@example.com"
//
// Prints a generated temporary password to THIS terminal only — copy it,
// sign in, and it's gone (nothing stores it in plaintext).

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const [, , fullName, email] = process.argv;

if (!fullName || !email) {
  console.error("Usage: node scripts/bootstrap-manager.mjs \"Full Name\" \"owner@example.com\"");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your shell before running this script.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

const tempPassword = randomBytes(12).toString("base64url");

const { data: created, error: createError } = await supabase.auth.admin.createUser({
  email,
  password: tempPassword,
  email_confirm: true,
});

if (createError || !created.user) {
  console.error("Failed to create the auth user:", createError?.message ?? "unknown error");
  process.exit(1);
}

const { error: profileError } = await supabase.from("chillbros_profiles").insert({
  id: created.user.id,
  full_name: fullName,
  email,
  role: "manager",
  status: "active",
});

if (profileError) {
  console.error("Auth user was created, but the profile row failed:", profileError.message);
  console.error(`Clean up manually if needed: auth user id ${created.user.id}`);
  process.exit(1);
}

console.log("Manager account created.");
console.log(`  Email:    ${email}`);
console.log(`  Password: ${tempPassword}`);
console.log("Sign in at /sign-in, then use the Manager Hub to add everyone else.");
