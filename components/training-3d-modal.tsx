"use client";

import Image from "next/image";
import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Crosshair, ExternalLink, Rotate3D, Wrench, X, Zap } from "lucide-react";

import type { TrainingVisual } from "@/lib/chillbros/training-cases";
import { componentMatchesCase, getTrainingModelMeta, type TrainingModelComponent } from "@/lib/chillbros/training-model-meta";

function positionAttribute(position: [number, number, number]) {
  return `${position[0]}m ${position[1]}m ${position[2]}m`;
}

function normalAttribute(normal: [number, number, number] | undefined) {
  const value = normal ?? [0, -1, 0];
  return `${value[0]}m ${value[1]}m ${value[2]}m`;
}

export function Training3DModal({ open, onClose, visual, components }: { open: boolean; onClose: () => void; visual: TrainingVisual; components: string[] }) {
  const viewerHost = useRef<HTMLDivElement>(null);
  const viewerElement = useRef<HTMLElement | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const modelMeta = useMemo(() => getTrainingModelMeta(visual.modelSlug), [visual.modelSlug]);
  const relevantComponents = useMemo(() => modelMeta.components.filter((component) => componentMatchesCase(component, components)), [components, modelMeta.components]);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);

  const selectedComponent = modelMeta.components.find((component) => component.id === selectedComponentId) ?? relevantComponents[0] ?? modelMeta.components[0] ?? null;

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
      viewer.setAttribute("interpolation-decay", "120");
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) viewer.setAttribute("auto-rotate", "");

      modelMeta.components.forEach((component) => {
        const hotspot = document.createElement("button");
        const relevant = componentMatchesCase(component, components);
        hotspot.type = "button";
        hotspot.slot = `hotspot-${component.id}`;
        hotspot.setAttribute("data-position", positionAttribute(component.position));
        hotspot.setAttribute("data-normal", normalAttribute(component.normal));
        hotspot.setAttribute("aria-label", `Focus ${component.label}`);
        hotspot.className = relevant
          ? "rounded-full border border-[#8ffafa]/80 bg-[#07152c]/95 px-2.5 py-1 text-[10px] font-semibold text-white shadow-[0_0_16px_rgba(143,250,250,0.42)] backdrop-blur"
          : "rounded-full border border-[#2d7dff]/55 bg-black/85 px-2 py-1 text-[9px] font-semibold text-[#d9fbff] shadow-[0_0_10px_rgba(45,125,255,0.22)] backdrop-blur";
        hotspot.textContent = component.label;
        hotspot.addEventListener("click", (event) => {
          event.stopPropagation();
          setSelectedComponentId(component.id);
          viewer.removeAttribute("auto-rotate");
          viewer.setAttribute("camera-target", positionAttribute(component.position));
          viewer.setAttribute("camera-orbit", "0deg 68deg 115%");
        });
        viewer.appendChild(hotspot);
      });

      host.replaceChildren(viewer);
      viewerElement.current = viewer;
    });

    return () => {
      cancelled = true;
      viewerElement.current = null;
      host.replaceChildren();
    };
  }, [components, modelMeta.components, open, viewerReady, visual.modelLabel, visual.modelSlug]);

  useEffect(() => {
    if (!selectedComponent || !viewerElement.current) return;
    viewerElement.current.querySelectorAll("button[slot^='hotspot-']").forEach((button) => {
      const selected = button.getAttribute("slot") === `hotspot-${selectedComponent.id}`;
      if (selected) button.setAttribute("data-selected", "true");
      else button.removeAttribute("data-selected");
    });
  }, [selectedComponent]);

  function focusComponent(component: TrainingModelComponent) {
    setSelectedComponentId(component.id);
    const viewer = viewerElement.current;
    if (!viewer) return;
    viewer.removeAttribute("auto-rotate");
    viewer.setAttribute("camera-target", positionAttribute(component.position));
    viewer.setAttribute("camera-orbit", "0deg 68deg 115%");
  }

  function resetView() {
    const viewer = viewerElement.current;
    if (!viewer) return;
    viewer.setAttribute("camera-target", "auto auto auto");
    viewer.setAttribute("camera-orbit", "45deg 65deg auto");
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) viewer.setAttribute("auto-rotate", "");
  }

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
          <div className="flex max-h-[96dvh] w-full max-w-7xl flex-col overflow-hidden rounded-t-3xl border border-[#2d7dff]/50 bg-[#020407] shadow-[0_0_50px_rgba(45,125,255,0.28)] sm:rounded-3xl">
            <div className="flex items-center justify-between gap-3 border-b border-[#2d7dff]/20 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="font-brand text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8ffafa]">Interactive training schematic</p>
                <h2 className="mt-1 truncate text-lg font-semibold text-white sm:text-xl">{visual.modelLabel}</h2>
              </div>
              <button ref={closeButton} type="button" onClick={onClose} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#2d7dff]/30 bg-black/50 text-white transition hover:bg-[#2d7dff]/15" aria-label="Close 3D viewer"><X className="h-5 w-5" /></button>
            </div>

            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
              <div className={`grid min-h-[430px] ${visual.referenceImage ? "lg:grid-cols-[1.45fr_0.55fr]" : ""}`}>
                <div className="relative min-h-[430px] overflow-hidden border-b border-[#2d7dff]/20 lg:min-h-[620px] lg:border-b-0 lg:border-r">
                  <div ref={viewerHost} className="h-full min-h-[430px] w-full lg:min-h-[620px] [&_button[data-selected='true']]:border-white [&_button[data-selected='true']]:bg-[#2d7dff] [&_button[data-selected='true']]:shadow-[0_0_22px_rgba(143,250,250,0.7)]" />
                  {!viewerReady ? <div className="absolute inset-0 flex items-center justify-center bg-[#020407]"><div className="text-center"><div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-[#2d7dff]/25 border-t-[#8ffafa]" /><p className="mt-3 text-sm text-zinc-400">Preparing 3D viewer…</p></div></div> : null}
                  <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-[#8ffafa]/25 bg-black/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d9fbff] backdrop-blur"><Rotate3D className="mr-1.5 inline h-3.5 w-3.5" />Drag to rotate · tap labels · pinch to zoom</div>
                  <button type="button" onClick={resetView} className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-[#2d7dff]/40 bg-black/75 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur"><Rotate3D className="h-3.5 w-3.5 text-[#8ffafa]" />Reset view</button>
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
                  {relevantComponents.length ? <div className="rounded-2xl border border-[#8ffafa]/20 bg-[#07152c]/60 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8ffafa]">Highlighted for this Bible case</p><div className="mt-3 flex flex-wrap gap-2">{relevantComponents.map((component) => <button key={component.id} type="button" onClick={() => focusComponent(component)} className="rounded-full border border-[#8ffafa]/30 bg-black/40 px-3 py-1.5 text-xs text-white hover:border-[#8ffafa]/70">{component.label}</button>)}</div></div> : null}
                </aside> : null}
              </div>

              {modelMeta.components.length ? (
                <div className="grid border-t border-[#2d7dff]/20 lg:grid-cols-[0.72fr_1.28fr]">
                  <section className="border-b border-[#2d7dff]/20 p-4 sm:p-5 lg:border-b-0 lg:border-r">
                    <div className="flex items-center gap-2"><Crosshair className="h-4 w-4 text-[#8ffafa]" /><h3 className="font-semibold text-white">RTU component map</h3></div>
                    <p className="mt-2 text-xs leading-5 text-zinc-500">Tap any component to focus the camera and open the field-training notes. Ice-blue items match the currently selected Bible case.</p>
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
                      {modelMeta.components.map((component) => {
                        const relevant = componentMatchesCase(component, components);
                        const active = selectedComponent?.id === component.id;
                        return <button key={component.id} type="button" onClick={() => focusComponent(component)} className={`min-h-14 rounded-xl border px-3 py-2 text-left text-xs transition ${active ? "border-white bg-[#2d7dff]/25 text-white shadow-[0_0_14px_rgba(143,250,250,0.28)]" : relevant ? "border-[#8ffafa]/45 bg-[#8ffafa]/5 text-[#d9fbff]" : "border-[#2d7dff]/20 bg-black/20 text-zinc-400 hover:border-[#2d7dff]/50"}`}><span className="block text-[9px] uppercase tracking-[0.14em] text-[#8ffafa]">{component.system}{relevant ? " · Case" : ""}</span><span className="mt-1 block font-semibold">{component.label}</span></button>;
                      })}
                    </div>
                  </section>

                  <section className="p-4 sm:p-5">
                    {selectedComponent ? <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8ffafa]">Selected component · {selectedComponent.system}</p><h3 className="mt-1 text-xl font-semibold text-white">{selectedComponent.label}</h3></div>
                        {componentMatchesCase(selectedComponent, components) ? <span className="rounded-full border border-emerald-300/30 bg-emerald-300/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">Used in this case</span> : null}
                      </div>

                      <div className="rounded-2xl border border-[#2d7dff]/25 bg-[#07152c]/50 p-4"><div className="flex items-center gap-2 text-white"><Zap className="h-4 w-4 text-[#8ffafa]" /><h4 className="font-semibold">What it does</h4></div><p className="mt-2 text-sm leading-6 text-zinc-300">{selectedComponent.purpose}</p></div>

                      <div className="grid gap-4 xl:grid-cols-2">
                        <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/20 p-4"><div className="flex items-center gap-2 text-white"><Crosshair className="h-4 w-4 text-[#8ffafa]" /><h4 className="font-semibold">Field checks</h4></div><ol className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">{selectedComponent.fieldChecks.map((check, index) => <li key={check} className="flex gap-2"><span className="w-5 shrink-0 text-[#8ffafa]">{index + 1}.</span><span>{check}</span></li>)}</ol></div>
                        <div className="space-y-4"><div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4"><div className="flex items-center gap-2 text-amber-100"><Wrench className="h-4 w-4" /><h4 className="font-semibold">Common failure pattern</h4></div><p className="mt-2 text-sm leading-6 text-zinc-300">{selectedComponent.commonFailure}</p></div><div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-4"><h4 className="font-semibold text-emerald-100">Next diagnostic move</h4><p className="mt-2 text-sm leading-6 text-zinc-300">{selectedComponent.nextStep}</p></div></div>
                      </div>
                    </div> : <p className="text-sm text-zinc-500">Select a component to begin.</p>}
                  </section>
                </div>
              ) : (
                <div className="border-t border-[#2d7dff]/20 p-4 sm:p-5">
                  <div className="flex items-center gap-2"><Box className="h-4 w-4 text-[#8ffafa]" /><h3 className="font-semibold text-white">Components tied to this Bible case</h3></div>
                  <div className="mt-3 flex flex-wrap gap-2">{components.map((component) => <span key={component} className="rounded-full border border-[#2d7dff]/25 bg-[#2d7dff]/5 px-3 py-1.5 text-xs text-[#d9fbff]">{component}</span>)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
