"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Rotate3D } from "lucide-react";

export function ThreeDAssetViewer({ src, label }: { src: string; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const target = host.current;
    if (!scriptReady || !target) return;
    let cancelled = false;

    window.customElements.whenDefined("model-viewer").then(() => {
      if (cancelled || !host.current) return;
      const viewer = document.createElement("model-viewer");
      viewer.setAttribute("src", src);
      viewer.setAttribute("alt", label);
      viewer.setAttribute("camera-controls", "");
      viewer.setAttribute("auto-rotate", "");
      viewer.setAttribute("shadow-intensity", "1");
      viewer.setAttribute("environment-image", "neutral");
      viewer.setAttribute("interaction-prompt", "auto");
      viewer.setAttribute("touch-action", "pan-y");
      viewer.setAttribute("loading", "eager");
      viewer.setAttribute("camera-orbit", "45deg 65deg auto");
      viewer.style.width = "100%";
      viewer.style.height = "100%";
      viewer.style.minHeight = "420px";
      viewer.addEventListener("load", () => setModelReady(true));
      viewer.addEventListener("error", () => setError("The 3D file exists, but the viewer could not load it on this device."));
      host.current.replaceChildren(viewer);
    }).catch(() => setError("The 3D viewer library did not load."));

    return () => {
      cancelled = true;
      target.replaceChildren();
    };
  }, [label, scriptReady, src]);

  return (
    <div className="relative min-h-[430px] overflow-hidden rounded-3xl border border-[#2d7dff]/45 bg-[#020407] shadow-[0_0_28px_rgba(45,125,255,0.2)]">
      <Script
        id="chillbros-asset-model-viewer"
        type="module"
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onReady={() => setScriptReady(true)}
        onError={() => setError("The 3D viewer library could not be loaded.")}
      />

      <div ref={host} className="min-h-[430px] w-full" />

      {!modelReady && !error ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#020407]">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#2d7dff]/25 border-t-[#8ffafa]" />
            <p className="mt-3 text-sm text-zinc-400">Loading 3D model…</p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#020407] p-6 text-center">
          <div className="max-w-md rounded-2xl border border-amber-300/25 bg-amber-300/5 p-5">
            <AlertTriangle className="mx-auto h-6 w-6 text-amber-200" />
            <p className="mt-3 text-sm leading-6 text-amber-100">{error}</p>
            <a href={src} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#8ffafa]/40 bg-[#2d7dff]/10 px-4 py-2 text-sm font-semibold text-white">
              <Rotate3D className="h-4 w-4" />Open raw 3D file
            </a>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-[#8ffafa]/25 bg-black/75 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d9fbff] backdrop-blur">
        <Rotate3D className="mr-1.5 inline h-3.5 w-3.5" />Drag to rotate · pinch to zoom
      </div>
    </div>
  );
}
