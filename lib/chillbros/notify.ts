import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";

// Owner phone notifications (ntfy). Goes through the database's chillbros_push()
// so the private topic lives in one place (chillbros_notify_settings). Never throws:
// a notification must not break the action that triggered it.
export async function notifyOwner(input: { title: string; message: string; priority?: 1 | 2 | 3 | 4 | 5; tags?: string[]; path?: string | null }) {
  try {
    const { error } = await createServiceRoleClient().rpc("chillbros_push", {
      p_title: input.title.slice(0, 120),
      p_message: input.message.slice(0, 900),
      p_priority: input.priority ?? 3,
      p_tags: input.tags ?? [],
      p_path: input.path ?? null,
    });
    if (error) console.error("[notify] push failed", error.message);
  } catch (error) {
    console.error("[notify] push failed", error instanceof Error ? error.message : error);
  }
}
