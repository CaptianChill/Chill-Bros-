// Reply desk pure logic: spotting machine-sent mail, trimming quoted history, and
// reading the brain's verdict. No imports so it is unit-tested directly.

export const REPLY_INTENTS = ["interested", "booking_request", "question", "wrong_contact", "not_interested", "unsubscribe", "out_of_office", "other"] as const;
export type ReplyIntent = (typeof REPLY_INTENTS)[number];

export type ReplyVerdict = { intent: ReplyIntent; hot: boolean; summary: string; reply: string };

/** Most auto-replies one contact gets in REPLY_WINDOW_DAYS before the owner takes over. */
export const REPLY_LIMIT_PER_CONTACT = 4;
export const REPLY_WINDOW_DAYS = 14;
/** Replies are only sent in daytime hours (Central). */
export const REPLY_HOURS = { start: 7, end: 21 };

export function replyHoursOpen(centralHour: number) {
  return centralHour >= REPLY_HOURS.start && centralHour < REPLY_HOURS.end;
}

/** Bounces, auto-responders, mailing lists and no-reply senders: never answered. */
export function isAutomatedMessage(msg: { from: string; subject: string | null; headers: Record<string, string> }) {
  const from = msg.from.toLowerCase();
  const h = (name: string) => String(msg.headers[name] ?? "").toLowerCase();
  if (/^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounce)/.test(from.split("@")[0] ?? "")) return true;
  if (h("auto-submitted") && h("auto-submitted") !== "no") return true;
  if (/bulk|list|junk|auto_reply/.test(h("precedence"))) return true;
  if (h("x-autoreply") || h("x-autorespond") || h("list-id")) return true;
  if (/^(auto(matic)?[ -]?reply|out of (the )?office|delivery status notification|undeliverable|mail delivery failed)/i.test(String(msg.subject ?? "").replace(/^(re|fw|fwd):\s*/i, ""))) return true;
  return false;
}

/** The new part of an email reply, without the quoted thread underneath. */
export function stripQuoted(text: string) {
  const lines = String(text ?? "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^On .{4,200} wrote:$/.test(t) || /^-{2,}\s*Original Message\s*-{2,}$/i.test(t) || (/^From: .+/.test(t) && out.join("").trim().length > 0) || /^_{10,}$/.test(t)) break;
    if (t.startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000);
}

export function replySubject(subject: string | null | undefined) {
  const s = String(subject ?? "").replace(/[\r\n]+/g, " ").trim() || "Chill Pros";
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}

/** Reads the brain's JSON. Null when it is missing or malformed (the owner takes over). */
export function parseReplyVerdict(text: string): ReplyVerdict | null {
  const raw = String(text ?? "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const p = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    const intent = String(p.intent ?? "") as ReplyIntent;
    if (!REPLY_INTENTS.includes(intent)) return null;
    return { intent, hot: p.hot === true, summary: String(p.summary ?? "").trim().slice(0, 200), reply: String(p.reply ?? "").trim() };
  } catch {
    return null;
  }
}

/** Intents that get a written answer. */
export function intentGetsReply(intent: ReplyIntent) {
  return ["interested", "booking_request", "question", "wrong_contact", "other"].includes(intent);
}
