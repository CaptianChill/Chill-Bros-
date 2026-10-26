import { getCurrentStaffProfile, OWNER_EMAIL } from "@/lib/supabase/auth-server";
import { hqOwner } from "@/lib/hq/owner-token";
import { askAI } from "@/lib/chillbros/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/hq/brai — Brae.I. in the cloud, the Command Center's Brae.I. tab (owner only).
 * Owner check: the CRM owner sign-in, or Brae's HQ sign-in token (x-hq-token). Inside Chill Pros HQ the page
 * calls this cross-origin, so HQ's origin is allowed below.
 * Body: { action: "chat", messages, profile }      -> { ok, text }   (Claude, OpenAI backup, via askAI)
 *       { action: "image", prompt, image?, size? } -> { ok, image }  (OpenAI images; an attached image is edited)
 * Keys stay server-side (ANTHROPIC_API_KEY, OPENAI_API_KEY); nothing is stored here.
 */
const HQ_ORIGIN = "https://chill-pros-hq.vercel.app";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";
const SIZES = new Set(["1024x1024", "1024x1536", "1536x1024"]);

function headers(request: Request): Record<string, string> {
  const base: Record<string, string> = { "Cache-Control": "private, no-store, max-age=0" };
  if (request.headers.get("origin") === HQ_ORIGIN) {
    base["Access-Control-Allow-Origin"] = HQ_ORIGIN;
    base["Vary"] = "Origin";
  }
  return base;
}

export async function OPTIONS(request: Request) {
  const h = headers(request);
  if (h["Access-Control-Allow-Origin"]) {
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "content-type, x-hq-token";
    h["Access-Control-Max-Age"] = "600";
  }
  return new Response(null, { status: 204, headers: h });
}

async function isOwner(request: Request): Promise<boolean> {
  if (await hqOwner(request.headers.get("x-hq-token"))) return true;
  const profile = await getCurrentStaffProfile().catch(() => null);
  return Boolean(profile && profile.email.toLowerCase() === OWNER_EMAIL);
}

const PERSONA = `You are Brae.I., Brae Morrison's personal AI, running inside his BB Command Center. Brae ("Big Booda") owns Chill Pros, an HVAC/R service company in San Antonio, Texas, and builds his own apps (BBB, Alpha Hunter, Chill Pros HQ, BoodaForge).
Personality: sharp, confident, money-motivated and honest, with a little swagger and humor. Never a yes-man: if an idea has a hole, say so and say how to fix it.
He usually dictates by voice, so fix speech-to-text mistakes silently.
Lead with the answer. Short sentences. Bullets for steps and lists. Money in US dollars.
For creating images, tell him to use the Create tab (you can write him a strong prompt for it).
You can't take actions in his apps from here; say what to do or where to do it.`;

type Msg = { role: "user" | "assistant"; content: string };

async function chat(body: Record<string, unknown>) {
  const profile = typeof body.profile === "string" ? body.profile.slice(0, 6000).trim() : "";
  const messages: Msg[] = (Array.isArray(body.messages) ? body.messages : [])
    .slice(-16)
    .map((m) => {
      const msg = (m ?? {}) as { role?: unknown; content?: unknown };
      return { role: msg.role === "assistant" ? "assistant" : "user", content: typeof msg.content === "string" ? msg.content.slice(0, 6000) : "" } as Msg;
    })
    .filter((m) => m.content);
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length) return { status: 400, json: { ok: false, error: "Say something first." } };
  const system = profile ? `${PERSONA}\n\nBRAE'S PROFILE (his own words; follow his preferences in it):\n${profile}` : PERSONA;
  const result = await askAI({ system, messages, maxTokens: 1800, timeoutMs: 60000, reasoningEffort: "low" });
  if (!result.ok) return { status: 502, json: { ok: false, error: "Couldn't answer right now. Try again." } };
  return { status: 200, json: { ok: true, text: result.text } };
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 4 * 1024 * 1024) return null;
  return new Blob([bytes], { type: match[1] });
}

async function image(body: Record<string, unknown>) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { status: 503, json: { ok: false, error: "Image making needs OPENAI_API_KEY in Vercel settings." } };
  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 4000) : "";
  if (!prompt) return { status: 400, json: { ok: false, error: "Describe what to make." } };
  const size = typeof body.size === "string" && SIZES.has(body.size) ? body.size : "1024x1024";
  const source = typeof body.image === "string" && body.image ? dataUrlToBlob(body.image) : null;
  if (typeof body.image === "string" && body.image && !source) return { status: 400, json: { ok: false, error: "That picture is too big or not a PNG/JPG/WebP." } };

  let response: Response;
  if (source) {
    const form = new FormData();
    form.set("model", IMAGE_MODEL);
    form.set("prompt", prompt);
    form.set("size", size);
    form.set("image", source, `upload.${source.type.split("/")[1]}`);
    response = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: AbortSignal.timeout(110_000) });
  } else {
    response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: IMAGE_MODEL, prompt, size, n: 1 }),
      signal: AbortSignal.timeout(110_000),
    });
  }
  const json = await response.json().catch(() => null) as { data?: Array<{ b64_json?: string; url?: string }>; error?: { message?: string } } | null;
  const first = json?.data?.[0];
  if (!response.ok || !first) {
    console.error("[brai] image failed", response.status, json?.error?.message);
    return { status: 502, json: { ok: false, error: json?.error?.message ? `OpenAI: ${json.error.message}` : "The image didn't come back. Try again." } };
  }
  return { status: 200, json: { ok: true, image: first.b64_json ? `data:image/png;base64,${first.b64_json}` : first.url } };
}

export async function POST(request: Request) {
  const h = headers(request);
  if (!(await isOwner(request))) return Response.json({ ok: false, error: "Owner sign-in required" }, { status: 401, headers: h });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ ok: false, error: "Bad request" }, { status: 400, headers: h }); }
  try {
    const out = body.action === "image" ? await image(body) : body.action === "chat" ? await chat(body) : { status: 400, json: { ok: false, error: "Unknown action" } };
    return Response.json(out.json, { status: out.status, headers: h });
  } catch (error) {
    console.error("[brai] failed", error);
    return Response.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500, headers: h });
  }
}
