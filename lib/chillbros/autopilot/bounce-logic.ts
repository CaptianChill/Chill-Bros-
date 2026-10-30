/** Only authenticated Gmail failure reports with an explicit failed recipient count. */
export function permanentBounceRecipients(message: { from: string; subject: string | null; text: string; headers: Record<string, string> }) {
  if (message.from.toLowerCase() !== "mailer-daemon@googlemail.com") return [];
  const auth = message.headers["authentication-results"] ?? "";
  if (!/dkim=pass[^;]*header\.i=@googlemail\.com/i.test(auth)) return [];
  if (!/^Delivery Status Notification \(Failure\)$/i.test(message.subject ?? "")) return [];
  if (!/(?:\b5\d\d\b|DNS Error)/i.test(message.text)) return [];
  return (message.headers["x-failed-recipients"] ?? "").toLowerCase().split(/[,;\s]+/)
    .filter((email) => /^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/.test(email));
}
