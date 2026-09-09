import { NextResponse } from "next/server";

import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const renderProfiles = {
  draft: { model: "gpt-image-2", quality: "medium" },
  professional: { model: "gpt-image-2.5-sunburst", quality: "high" },
  photorealistic: { model: "gpt-image-2.5-sunburst", quality: "xhigh" },
} as const;

type RenderProfile = keyof typeof renderProfiles;

function cleanOption(value: FormDataEntryValue | null, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, 160) || fallback;
}

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
    const requestedProfile = String(incoming.get("renderProfile") || "photorealistic") as RenderProfile;
    const renderProfile: RenderProfile = requestedProfile in renderProfiles ? requestedProfile : "photorealistic";
    const environment = cleanOption(incoming.get("environment"), "Match the real source environment");
    const presentation = cleanOption(incoming.get("presentation"), "Installed finished-project view");

    if (!(source instanceof File)) {
      return NextResponse.json({ error: "A source property photo is required." }, { status: 400 });
    }
    if (!prompt) {
      return NextResponse.json({ error: "Finished-project instructions are required." }, { status: 400 });
    }
    if (!source.type.startsWith("image/")) {
      return NextResponse.json({ error: "The uploaded source must be an image." }, { status: 400 });
    }
    if (source.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "The source photo must be 20 MB or smaller." }, { status: 413 });
    }

    const selectedProfile = renderProfiles[renderProfile];
    const realismInstructions = [
      prompt,
      `Render profile: ${renderProfile}.`,
      `Environment target: ${environment}.`,
      `Presentation target: ${presentation}.`,
      "Photographic realism requirements:",
      "- Treat the uploaded image as the visual source of truth. Preserve its camera position, lens perspective, building proportions, doors, windows, roof lines, permanent structure, and all areas not explicitly included in the scope.",
      "- Make requested construction and HVAC changes physically plausible, correctly scaled, cleanly installed, and consistent with real materials and gravity.",
      "- Use realistic PBR-like material appearance: believable metal roughness, painted surfaces, wood grain, masonry, glass reflections, insulation, conduit, copper, fasteners, seams, joints, weathering, and small surface imperfections where appropriate.",
      "- Use natural global illumination, contact shadows, ambient occlusion, realistic reflections, balanced exposure, and physically believable daylight or practical lighting appropriate to the source scene.",
      "- Avoid plastic CGI surfaces, toy-like geometry, oversaturated colors, fantasy lighting, impossible reflections, warped architecture, floating equipment, duplicated objects, fake text, random signage, and unsupported additions.",
      "- HVAC and mechanical equipment must read as real installed equipment with convincing dimensions, mounting, clearances, line sets, conduit, drains, pads, curbs, fasteners, and connections when visible and applicable.",
      "- The final image should look like a high-end professional construction completion photograph, not a concept sketch, game render, or obvious AI image.",
    ].join("\n");

    const outbound = new FormData();
    outbound.append("model", selectedProfile.model);
    outbound.append("image", source, source.name || "source-property.png");
    outbound.append("prompt", realismInstructions);
    outbound.append("size", "1536x1024");
    outbound.append("quality", selectedProfile.quality);

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
      renderProfile,
      model: selectedProfile.model,
      quality: selectedProfile.quality,
      environment,
      presentation,
    });
  } catch (error) {
    console.error("3D project render failed", error);
    return NextResponse.json({ error: "Unable to generate the completed-project visual." }, { status: 500 });
  }
}
