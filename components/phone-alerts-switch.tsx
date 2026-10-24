"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";

import { removePushSubscriptionAction, savePushSubscriptionAction, sendTestPushAction } from "@/lib/chillbros/web-push-actions";

type State = "checking" | "needs-install" | "unsupported" | "blocked" | "off" | "on" | "working";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Owner-only: turn on Chill Pros app notifications (shows the Chill Pros icon, not ntfy's). */
export function PhoneAlertsSwitch() {
  const [state, setState] = useState<State>("checking");
  const [note, setNote] = useState("");
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

  useEffect(() => {
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setState(isIos() && !isStandalone() ? "needs-install" : "unsupported");
      if (!vapidKey) return setState("unsupported");
      if (Notification.permission === "denied") return setState("blocked");
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      const existing = await registration.pushManager.getSubscription();
      setState(existing ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [vapidKey]);

  async function turnOn() {
    setState("working");
    setNote("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "blocked" : "off");
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) }));
      const saved = await savePushSubscriptionAction(JSON.parse(JSON.stringify(subscription)), navigator.userAgent);
      if (!saved.ok) {
        setNote(saved.error);
        return setState("off");
      }
      setState("on");
      const test = await sendTestPushAction();
      setNote(test.ok ? "Test alert sent." : "Saved, but the test alert didn't go out yet.");
    } catch {
      setNote("Couldn't turn alerts on. Try again.");
      setState("off");
    }
  }

  async function turnOff() {
    setState("working");
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await removePushSubscriptionAction(subscription.endpoint);
      await subscription.unsubscribe().catch(() => undefined);
    }
    setNote("");
    setState("off");
  }

  async function sendTest() {
    setNote("Sending…");
    const test = await sendTestPushAction();
    setNote(test.ok ? "Test alert sent." : "No alert went out. Turn alerts off and on again.");
  }

  const help =
    state === "needs-install"
      ? "On iPhone: tap Share, then Add to Home Screen. Open Chill Bros from the home screen and come back here."
      : state === "blocked"
        ? "Notifications are blocked. Turn them on in Settings → Notifications → Chill Bros."
        : state === "unsupported"
          ? "This browser can't receive app alerts."
          : "Alerts show the Chill Pros icon. ntfy keeps working as a backup.";

  return (
    <div className="mt-4 rounded-xl border border-[#C7D3E2] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <BellRing className="h-4 w-4 shrink-0 text-[#1B3FD0]" aria-hidden="true" />
          <p className="text-sm font-semibold">Phone alerts</p>
        </div>
        {state === "on" ? (
          <div className="flex gap-2">
            <button type="button" onClick={sendTest} className="min-h-9 rounded-lg border border-[#C7D3E2] px-3 text-xs font-semibold">Test</button>
            <button type="button" onClick={turnOff} className="min-h-9 rounded-lg border border-[#C7D3E2] px-3 text-xs font-semibold">Turn off</button>
          </div>
        ) : state === "off" || state === "working" ? (
          <button type="button" onClick={turnOn} disabled={state === "working"} className="min-h-9 rounded-lg bg-[#1B3FD0] px-3 text-xs font-semibold text-white disabled:opacity-60">
            {state === "working" ? "Working…" : "Turn on"}
          </button>
        ) : null}
      </div>
      <p className="mt-1.5 text-xs text-[#2B3F5C]">{state === "on" && !note ? "On for this device. " : ""}{note || help}</p>
    </div>
  );
}
