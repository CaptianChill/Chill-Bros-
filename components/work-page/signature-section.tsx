"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eraser, PenLine } from "lucide-react";

import { captureJobSignatureAction } from "@/lib/chillbros/work-page-actions";

type Signature = { signerName: string | null; customerUnavailable: boolean; capturedAt: string; capturedByName: string | null; url: string | null };

const field = "mt-1 min-h-12 w-full rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] px-3 text-base font-medium text-[#0A1A33] placeholder:text-[#5B6B82]";
const when = (value: Date | string) => new Date(value).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Customer sign-off on site. The parent only renders this once the job is
 * repairing or later; captureJobSignatureAction enforces the same rule.
 */
export function SignatureSection({ jobId, latest, canCapture }: { jobId: string; latest: Signature | null; canCapture: boolean }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [name, setName] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(!latest);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // Size the canvas to its box at device resolution so the ink is crisp.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !editing || unavailable) return;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0A1A33";
    queueMicrotask(() => setHasInk(false));
  }, [editing, unavailable]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const { x, y } = point(event);
    context.beginPath();
    context.moveTo(x, y);
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const { x, y } = point(event);
    context.lineTo(x, y);
    context.stroke();
    if (!hasInk) setHasInk(true);
  };
  const end = () => {
    drawing.current = false;
  };
  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };

  const save = () => {
    setError(null);
    if (!unavailable && name.trim().length < 2) return setError("Enter the customer's printed name.");
    if (!unavailable && !hasInk) return setError("Have the customer sign in the box.");
    const png = unavailable ? null : canvasRef.current?.toDataURL("image/png") ?? null;
    startTransition(async () => {
      const result = await captureJobSignatureAction({ jobId, signerName: name, signaturePng: png, customerUnavailable: unavailable });
      if (!result.ok) return setError(result.error);
      setEditing(false);
      router.refresh();
    });
  };

  return (
    <section id="signature" aria-labelledby="signature-title" className="cb-work-card scroll-mt-24 p-3.5">
      <h2 id="signature-title" className="flex items-center gap-2 text-lg font-bold"><PenLine className="h-5 w-5 text-[#1557B0]" aria-hidden="true" />Customer approval</h2>
      {latest && !editing ? (
        <div className="mt-2 space-y-2">
          {latest.customerUnavailable ? (
            <p className="rounded-xl bg-[#FFF7E0] p-2.5 text-sm font-semibold">Customer unavailable to sign</p>
          ) : (
            <>
              {latest.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from the private bucket
                <img src={latest.url} alt={`Signature of ${latest.signerName ?? "customer"}`} className="h-28 w-full rounded-xl border border-[#C7D3E2] bg-white object-contain" />
              ) : null}
              <p className="text-sm font-bold">{latest.signerName}</p>
            </>
          )}
          <p className="text-[13px] font-medium text-[#2B3F5C]">{when(latest.capturedAt)}{latest.capturedByName ? ` · captured by ${latest.capturedByName}` : ""}</p>
          {canCapture ? <button type="button" onClick={() => setEditing(true)} className="min-h-11 text-sm font-semibold text-[#1557B0]">Capture again</button> : null}
        </div>
      ) : canCapture ? (
        <div className="mt-2 space-y-2.5">
          <label className="block text-sm font-semibold">
            Customer printed name
            <input value={name} onChange={(event) => setName(event.target.value)} disabled={unavailable} maxLength={200} autoComplete="off" placeholder="Full name" className={field} />
          </label>
          {!unavailable ? (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Signature</span>
                <button type="button" onClick={clear} className="inline-flex min-h-11 items-center gap-1 px-2 text-sm font-semibold text-[#1557B0]"><Eraser className="h-4 w-4" aria-hidden="true" />Clear</button>
              </div>
              <canvas
                ref={canvasRef}
                aria-label="Signature pad — sign with a finger"
                role="img"
                onPointerDown={start}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
                onPointerLeave={end}
                className="h-40 w-full touch-none rounded-xl border-2 border-dashed border-[#1557B0] bg-white"
              />
            </div>
          ) : null}
          <label className="flex min-h-11 items-center gap-2.5 text-sm font-semibold">
            <input type="checkbox" checked={unavailable} onChange={(event) => setUnavailable(event.target.checked)} className="h-5 w-5" />
            Customer unavailable
          </label>
          <p className="text-[13px] font-medium text-[#2B3F5C]">Date / time: {when(now)}</p>
          <button type="button" onClick={save} disabled={pending} className="min-h-12 w-full rounded-xl bg-[#1557B0] font-semibold text-white disabled:opacity-60">{pending ? "Saving…" : unavailable ? "Record customer unavailable" : "Save signature"}</button>
          {error ? <p role="alert" className="text-sm font-semibold text-[#B42318]">{error}</p> : null}
        </div>
      ) : (
        <p className="mt-1 text-sm font-medium text-[#2B3F5C]">No on-site signature captured.</p>
      )}
    </section>
  );
}
