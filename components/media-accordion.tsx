import { Camera, CheckCircle2, Upload } from "lucide-react";

import { StatusPill } from "@/components/status-pill";

export function MediaAccordion({ beforePhotos, afterPhotos }: { beforePhotos: string[]; afterPhotos: string[] }) {
  return (
    <details className="group rounded-3xl border border-cyan-400/30 bg-black/40 p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white">Before &amp; After Photos</p>
          <p className="mt-1 text-sm text-zinc-400">Collapsed by default for mobile-friendly service entry.</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill>Accordion upload zone</StatusPill>
        </div>
      </summary>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-cyan-400/20 bg-zinc-950/80 p-4">
          <div className="mb-3 flex items-center gap-2 text-cyan-200">
            <Camera className="h-4 w-4" />
            <h3 className="font-medium">Before photos</h3>
          </div>
          <div className="space-y-3">
            {beforePhotos.map((photo) => (
              <div key={photo} className="flex items-center justify-between rounded-2xl border border-cyan-400/20 bg-black/60 px-3 py-2 text-sm text-zinc-200">
                <span>{photo}</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              </div>
            ))}
          </div>
          <button type="button" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-cyan-400/40 px-4 py-3 text-sm text-cyan-100 transition hover:bg-cyan-400/10">
            <Upload className="h-4 w-4" />
            Capture / upload before image
          </button>
        </div>
        <div className="rounded-2xl border border-cyan-400/20 bg-zinc-950/80 p-4">
          <div className="mb-3 flex items-center gap-2 text-cyan-200">
            <Camera className="h-4 w-4" />
            <h3 className="font-medium">After photos</h3>
          </div>
          <div className="space-y-3">
            {afterPhotos.map((photo) => (
              <div key={photo} className="flex items-center justify-between rounded-2xl border border-cyan-400/20 bg-black/60 px-3 py-2 text-sm text-zinc-200">
                <span>{photo}</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              </div>
            ))}
          </div>
          <button type="button" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-cyan-400/40 px-4 py-3 text-sm text-cyan-100 transition hover:bg-cyan-400/10">
            <Upload className="h-4 w-4" />
            Capture / upload after image
          </button>
        </div>
      </div>
    </details>
  );
}
