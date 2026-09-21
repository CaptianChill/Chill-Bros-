import { NextResponse } from "next/server";

import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const renderProfiles = {
  draft: { model: "gpt-image-2", quality: "medium" },
  professional: { model: "gpt-image-2.5-sunburst", quality: "high" },
  photorealistic: { model: "gpt-image-2.5-sunburst", quality: "xhigh" },
} as const;

type RenderProfile = keyof typeof renderProfiles;
type ImageAttempt = { model: string; quality: string };
type ImageProviderPayload = {
  error?: { message?: string; code?: string; type?: string };
  data?: { b64_json?: string; url?: string; revised_prompt?: string }[];
};

function cleanOption(value: FormDataEntryValue | null, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, 160) || fallback;
}

async function requestImageEdit(apiKey: string, source: File, prompt: string, attempt: ImageAttempt) {
  const outbound = new FormData();
  outbound.append("model", attempt.model);
  outbound.append("image", source, source.name || "source-property.png");
  outbound.append("prompt", prompt);
  outbound.append("size", "1536x1024");
  outbound.append("quality", attempt.quality);

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: outbound,
    cache: "no-store",
    signal: AbortSignal.timeout(150_000),
  });

  const payload = (await response.json().catch(() => ({}))) as ImageProviderPayload;
  return { response, payload };
}

export async function POST(request: Request) {
  try {
    const staff = await getCurrentStaffProfile();
    if (!staff || staff.role !== "manager") {
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

    const attempts: ImageAttempt[] = [{ model: selectedProfile.model, quality: selectedProfile.quality }];
    if (selectedProfile.model !== "gpt-image-2") {
      attempts.push({ model: "gpt-image-2", quality: "high" });
    }

    let lastPayload: ImageProviderPayload = {};
    let lastStatus = 500;
    const attemptedModels: string[] = [];

    for (const attempt of attempts) {
      attemptedModels.push(`${attempt.model}:${attempt.quality}`);
      const { response, payload } = await requestImageEdit(apiKey, source, realismInstructions, attempt);
      lastPayload = payload;
      lastStatus = response.status;

      if (!response.ok) {
        const providerMessage = payload?.error?.message || "Image provider rejected the request.";
        const providerCode = payload?.error?.code || payload?.error?.type || "unknown";
        console.error("3D photo render provider failure", {
          status: response.status,
          model: attempt.model,
          quality: attempt.quality,
          code: providerCode,
          message: providerMessage,
        });

        const retryableModelFailure = response.status === 400 || response.status === 403 || response.status === 404 || response.status === 422;
        if (attempt !== attempts[attempts.length - 1] && retryableModelFailure) continue;
        break;
      }

      const first = payload?.data?.[0];
      const base64 = first?.b64_json;
      const url = first?.url;
      if (!base64 && !url) {
        lastStatus = 502;
        lastPayload = { error: { message: "The image provider returned no image data.", code: "empty_image" } };
        continue;
      }

      return NextResponse.json({
        image: base64 ? `data:image/png;base64,${base64}` : url,
        revisedPrompt: first?.revised_prompt || null,
        renderProfile,
        model: attempt.model,
        quality: attempt.quality,
        environment,
        presentation,
        fallbackUsed: attempt.model !== selectedProfile.model,
      });
    }

    const providerMessage = lastPayload?.error?.message || "The image provider did not return a usable render.";
    const providerCode = lastPayload?.error?.code || lastPayload?.error?.type || "unknown";
    return NextResponse.json(
      {
        error: providerMessage,
        providerCode,
        providerStatus: lastStatus,
        attemptedModels,
      },
      { status: lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502 },
    );
  } catch (error) {
    console.error("3D project photo render failed", error);
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return NextResponse.json(
      { error: timedOut ? "The image render timed out before the provider returned a result." : "Unable to generate the completed-project visual." },
      { status: timedOut ? 504 : 500 },
    );
  }
}
