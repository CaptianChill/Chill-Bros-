import "server-only";

export type NeonDataApiConfig = {
  url: string;
  anonymousKey: string;
  serviceRoleKey: string;
};

function firstConfigured(...values: Array<string | undefined>): string {
  return values.find((value) => value?.trim())?.trim() ?? "";
}

function assertNeonDataApiUrl(rawUrl: string): string {
  const url = rawUrl.replace(/\/$/, "");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("NEON_DATA_API_URL must be a valid HTTPS URL.");
  }

  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".neon.tech")) {
    throw new Error(
      "Chill Bros is Neon-only. NEON_DATA_API_URL must point to the approved Neon Data API, never a Supabase project.",
    );
  }

  return url;
}

/**
 * Chill Bros backend boundary.
 *
 * NEON_DATA_API_* names are canonical. SUPABASE_* is accepted temporarily as
 * a deployment alias because the Neon Data API is PostgREST-compatible and the
 * existing Vercel project still uses those legacy variable names. Regardless
 * of the variable name, the URL guard prevents this app from connecting to a
 * Supabase-hosted database.
 */
export function getNeonDataApiConfig(): NeonDataApiConfig | null {
  const rawUrl = firstConfigured(process.env.NEON_DATA_API_URL, process.env.SUPABASE_URL);
  const anonymousKey = firstConfigured(process.env.NEON_DATA_API_ANON_KEY, process.env.SUPABASE_ANON_KEY);
  const serviceRoleKey = firstConfigured(
    process.env.NEON_DATA_API_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  if (!rawUrl || !anonymousKey || !serviceRoleKey) return null;
  return { url: assertNeonDataApiUrl(rawUrl), anonymousKey, serviceRoleKey };
}
