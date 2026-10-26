import { getCurrentStaffProfile, OWNER_EMAIL } from "@/lib/supabase/auth-server";
import { ask, createChangeRequest } from "@/lib/hq/bridge";
import { hqOwner } from "@/lib/hq/owner-token";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const noStore = { "Cache-Control": "private, no-store, max-age=0" };

/**
 * POST /api/command-center/talk — the BB Command Center's Talk button.
 * Owner only: the CRM owner sign-in, or Brae's HQ sign-in token (x-hq-token) when the Command Center
 * runs inside Chill Pros HQ (HQ's /cc-talk forwards here).
 * Body: { action: "ask", message, history } -> the same assistant HQ uses (answers, quotes/invoices, app changes)
 *       { action: "change", request }        -> queues an app change for the hourly build runner (owner tapped "Queue it")
 * Nothing is created from speech alone: app changes need the owner's tap; quotes, invoices and reminders finish in HQ.
 */
export async function POST(request: Request) {
  const profile = await getCurrentStaffProfile();
  const crmOwner = Boolean(profile && profile.email.toLowerCase() === OWNER_EMAIL);
  if (!crmOwner && !(await hqOwner(request.headers.get("x-hq-token")))) {
    return Response.json({ ok: false, error: "Owner sign-in required" }, { status: 401, headers: noStore });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Bad request" }, { status: 400, headers: noStore });
  }
  try {
    if (body.action === "ask") {
      const history = (Array.isArray(body.history) ? body.history : []) as NonNullable<Parameters<typeof ask>[0]["history"]>;
      return Response.json(await ask({ message: String(body.message ?? ""), history, draft: null }), { headers: noStore });
    }
    if (body.action === "change") {
      return Response.json(await createChangeRequest({ request: String(body.request ?? "") }), { headers: noStore });
    }
    return Response.json({ ok: false, error: "Unknown action" }, { status: 400, headers: noStore });
  } catch (error) {
    console.error("[command-center] talk failed", error);
    return Response.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500, headers: noStore });
  }
}
