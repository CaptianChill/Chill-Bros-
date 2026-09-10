"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function LiveOfficeRefresh({ intervalMs = 10000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const canRefresh = () => {
      if (document.visibilityState !== "visible") return false;
      const active = document.activeElement?.tagName;
      return active !== "INPUT" && active !== "TEXTAREA" && active !== "SELECT";
    };

    const refresh = () => {
      if (canRefresh()) router.refresh();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    const timer = window.setInterval(refresh, intervalMs);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, router]);

  return null;
}
