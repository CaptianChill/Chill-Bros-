"use client";

import Image from "next/image";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { Box, ExternalLink, Rotate3D, X } from "lucide-react";

import type { TrainingVisual } from "@/lib/chillbros/training-cases";

export function Training3DModal({ open, onClose, visual, components }: { open: boolean; onClose: () => void; visual: TrainingVisual; components: string[] }) {
  const viewerHost = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [viewerReady, setViewerReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => closeButton.current?.focus(), 0);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    const host = viewerHost.current;
    if (!open || !viewerReady || !host) return;
    let cancelled = false;

    window.customElements.whenDefined("model-viewer").then(() => {
      if (cancelled) return;
      const viewer = document.createElement("model-viewer");
      viewer.setAttribute("src", `/training/model/${visual.modelSlug}`);
      viewer.setAttribute("alt", visual.modelLabel);
      viewer.setAttribute("camera-controls", "");
      viewer.setAttribute("shadow-intensity", "1");
      viewer.setAttribute("environment-image", "neutral");
      viewer.setAttribute("interaction-prompt", "auto");
      viewer.setAttribute("touch-action", "pan-y");
      viewer.setAttribute("loading", "eager");
      viewer.setAttribute("camera-orbit", "45deg 65deg auto");
      viewer.setAttribute("min-camera-orbit", "auto 15deg 55%");
      viewer.setAttribute("max-camera-orbit", "auto 90deg 250%");
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) viewer.setAttribute("auto-rotate", "");
      host.replaceChildren(viewer);
    });

    return () => {
      cancelled = true;
      host.replaceChildren();
    };
  }, [open, viewerReady, visual.modelLabel, visual.modelSlug]);

  return (
    <>
      <Script
        id="chillbros-model-viewer"
        type="module"
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js"
        strategy="afterInteractive"
        onLoad={() => setViewerReady(true)}
        onReady={() => setViewerReady(true)}
      />
      {open ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`${visual.modelLabel} interactive viewer`} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
          <div className="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl border border-[#2d7dff]/50 bg-[#020407] shadow-[0_0_50px_rgba(45,125,255,0.28)] sm:rounded-3xl">
            <div className="flex items-center justify-between gap-3 border-b border-[#2d7dff]/20 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="font-brand text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8ffafa]">Interactive training schematic</p>
                <h2 className="mt-1 truncate text-lg font-semibold text-white sm:text-xl">{visual.modelLabel}</h2>
              </div>
              <button ref={closeButton} type="button" onClick={onClose} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#2d7dff]/30 bg-black/50 text-white transition hover:bg-[#2d7dff]/15" aria-label="Close 3D viewer"><X className="h-5 w-5" /></button>
            </div>

            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
              <div className={`grid min-h-[430px] ${visual.referenceImage ? "lg:grid-cols-[1.45fr_0.55fr]" : ""}`}>
                <div className="relative min-h-[430px] overflow-hidden border-b border-[#2d7dff]/20 lg:min-h-[600px] lg:border-b-0 lg:border-r">
                  <div ref={viewerHost} className="h-full min-h-[430px] w-full lg:min-h-[600px]" />
                  {!viewerReady ? <div className="absolute inset-0 flex items-center justify-center bg-[#020407]"><div className="text-center"><div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-[#2d7dff]/25 border-t-[#8ffafa]" /><p className="mt-3 text-sm text-zinc-400">Preparing 3D viewer…</p></div></div> : null}
                  <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-[#8ffafa]/25 bg-black/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d9fbff] backdrop-blur"><Rotate3D className="mr-1.5 inline h-3.5 w-3.5" />Drag to rotate · pinch to zoom</div>
                  <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-xl border border-amber-300/20 bg-black/75 px-3 py-2 text-[11px] leading-4 text-amber-100 backdrop-blur">Generic service-training geometry. Use the actual manufacturer model/serial, wiring diagram, and service manual for OEM-specific locations and procedures.</div>
                </div>

                {visual.referenceImage ? <aside className="space-y-4 p-4 sm:p-5">
                  <div>
                    <p className="font-brand text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8ffafa]">Real equipment reference</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">Use this photo for general equipment orientation only. It is not the exact unit represented by the schematic.</p>
                  </div>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-[#2d7dff]/25 bg-black/50">
                    <Image src={visual.referenceImage} alt={visual.referenceAlt ?? visual.modelLabel} fill sizes="(max-width: 1024px) 100vw, 32vw" className="object-cover" />
                  </div>
                  {visual.referenceSource ? <a href={visual.referenceSource} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs leading-5 text-[#bafcfc] underline decoration-[#2d7dff]/50 underline-offset-4"><ExternalLink className="h-3.5 w-3.5 shrink-0" />{visual.referenceCredit ?? "Reference source"}</a> : null}
                </aside> : null}
              </div>

              <div className="border-t border-[#2d7dff]/20 p-4 sm:p-5">
                <div className="flex items-center gap-2"><Box className="h-4 w-4 text-[#8ffafa]" /><h3 className="font-semibold text-white">Components tied to this Bible case</h3></div>
                <div className="mt-3 flex flex-wrap gap-2">{components.map((component) => <span key={component} className="rounded-full border border-[#2d7dff]/25 bg-[#2d7dff]/5 px-3 py-1.5 text-xs text-[#d9fbff]">{component}</span>)}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
