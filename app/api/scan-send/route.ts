import { NextResponse } from "next/server";

import { getCurrentStaffProfile } from "@/lib/neon/data-api/auth-server";

export const runtime = "nodejs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function approvedRecipients() {
  return (process.env.SCAN_ALLOWED_RECIPIENTS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function cleanFilename(value: unknown) {
  return String(value || "scanned-paperwork.pdf")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

export async function POST(request: Request) {
  try {
    const profile = await getCurrentStaffProfile();
    if (!profile) return NextResponse.json({ error: "You must be signed in to send scans." }, { status: 401 });

    const apiKey = (process.env.RESEND_API_KEY || "").trim();
    const from = (process.env.SCAN_FROM_EMAIL || "").trim();
    if (!apiKey || !from) {
      return NextResponse.json(
        { error: "Scan email delivery is not configured yet. Add RESEND_API_KEY and SCAN_FROM_EMAIL in Vercel." },
        { status: 503 },
      );
    }

    const body = await request.json();
    const to = String(body?.to || "").trim();
    const subject = String(body?.subject || "Chill Bros scanned paperwork").trim().slice(0, 180);
    const notes = String(body?.notes || "").trim().slice(0, 5000);
    const pdfBase64 = String(body?.pdfBase64 || "");
    const filename = cleanFilename(body?.filename);

    if (!EMAIL_PATTERN.test(to)) return NextResponse.json({ error: "Enter a valid recipient email." }, { status: 400 });
    if (!pdfBase64) return NextResponse.json({ error: "No PDF was received." }, { status: 400 });
    if (pdfBase64.length > 4_500_000) {
      return NextResponse.json({ error: "This scan is too large for one email. Send fewer pages at a time." }, { status: 413 });
    }

    const allowlist = approvedRecipients();
    if (allowlist.length && !allowlist.includes(to.toLowerCase())) {
      return NextResponse.json({ error: "That address is not on the approved scan-recipient list." }, { status: 403 });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: subject || "Chill Bros scanned paperwork",
        text: notes || `Scanned paperwork sent by ${profile.fullName} through the Chill Bros app.`,
        attachments: [{ filename, content: pdfBase64 }],
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.message || data?.error?.message || "The email provider rejected this message.";
      return NextResponse.json({ error: message }, { status: response.status >= 400 && response.status < 600 ? response.status : 502 });
    }

    return NextResponse.json({ ok: true, id: data?.id || null });
  } catch (error) {
    console.error("scan-send failed", error);
    return NextResponse.json({ error: "The scan could not be sent. Try again." }, { status: 500 });
  }
}
