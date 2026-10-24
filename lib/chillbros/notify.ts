import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";

// Owner phone notifications (ntfy), kept short: a colored dot for urgency, a few words,
// one line of detail. Goes through the database's chillbros_push() so the private
// topic lives in one place. Never throws.
//   urgent    red     act now (emergency call, payment problem)
//   important orange  new business (booking, customer request, lead)
//   good      green   money or approval
//   info      blue    team activity (new call, readings, field note)
//   low       white   FYI (invoice opened, Autopilot summary)
export type PushLevel = "urgent" | "important" | "good" | "info" | "low";

const LEVEL: Record<PushLevel, { priority: number; tag: string }> = {
  urgent: { priority: 5, tag: "red_circle" },
  important: { priority: 4, tag: "orange_circle" },
  good: { priority: 3, tag: "green_circle" },
  info: { priority: 3, tag: "large_blue_circle" },
  low: { priority: 2, tag: "white_circle" },
};

export async function notifyOwner(input: { title: string; message: string; level: PushLevel; path?: string | null }) {
  const level = LEVEL[input.level];
  try {
    const { error } = await createServiceRoleClient().rpc("chillbros_push", {
      p_title: input.title.slice(0, 80),
      p_message: input.message.replace(/\s+/g, " ").trim().slice(0, 140),
      p_priority: level.priority,
      p_tags: [level.tag],
      p_path: input.path ?? null,
    });
    if (error) console.error("[notify] push failed", error.message);
  } catch (error) {
    console.error("[notify] push failed", error instanceof Error ? error.message : error);
  }
}
