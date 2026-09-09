import { NextResponse } from "next/server";

import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const profile = await getCurrentStaffProfile();
    if (!profile || profile.role !== "manager") {
      return NextResponse.json({ error: "Manager access required." }, { status: 401 });
    }

    const apiKey = (process.env.OPENAI_API_KEY || "").trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured on this deployment." },
        { status: 503 },
      );
    }

    const incoming = await request.formData();
    const source = incoming.get("image");
    const prompt = String(incoming.get("prompt") || "").trim();

    if (!(source instanceof File)) {
      return NextResponse.json({ error: "A source property photo is required." }, { status: 400 });
    }
    if (!prompt) {
      return NextResponse.json({ error: "Finished-project instructions are required." }, { status: 400 });
    }
    if (!source.type.startsWith("image/")) {
      return NextResponse.json({ error: "The uploaded source must be an image." }, { status: 400 });
    }

    const outbound = new FormData();
    outbound.append("model", "gpt-image-2");
    outbound.append("image", source, source.name || "source-property.png");
    outbound.append("prompt", prompt);
    outbound.append("size", "1536x1024");
    outbound.append("quality", "high");

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: outbound,
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error?.message || "The image generation request failed.";
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const first = payload?.data?.[0];
    const base64 = first?.b64_json;
    const url = first?.url;

    if (!base64 && !url) {
      return NextResponse.json({ error: "The image service returned no finished image." }, { status: 502 });
    }

    return NextResponse.json({
      image: base64 ? `data:image/png;base64,${base64}` : url,
      revisedPrompt: first?.revised_prompt || null,
    });
  } catch (error) {
    console.error("3D project render failed", error);
    return NextResponse.json({ error: "Unable to generate the completed-project visual." }, { status: 500 });
  }
}
