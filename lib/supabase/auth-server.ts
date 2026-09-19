// Temporary compatibility bridge for Revenue Radar feature work created before
// the canonical Neon data-api path landed on main. This does not connect to a
// Supabase backend; it forwards directly to the single Neon implementation.
export { getCurrentStaffProfile } from "@/lib/neon/data-api/auth-server";
export type { StaffProfile } from "@/lib/neon/data-api/auth-server";
