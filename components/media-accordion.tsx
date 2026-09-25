"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, Maximize2, Upload, X } from "lucide-react";

import { downscaleImage } from "@/lib/chillbros/client-image";
import { uploadJobPhotoAction } from "@/lib/chillbros/mutations";
import { StatusPill } from "@/components/status-pill";

type Photo = { id: string; caption: string | null; url: string | null };
export type PreviewPhoto = { url: string; alt: string };

function PhotoColumn({ jobId, phase, photos, label, readOnly, onOpen }: { jobId: string; phase: "before" | "after"; photos: Photo[]; label: string; readOnly?: boolean; onOpen: (photo: PreviewPhoto) => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const result = await uploadJobPhotoAction(jobId, phase, await downscaleImage(file));
      if (!result.ok) {
        setError(result.error);
      } else {
        router.refresh();
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  return (
    <div className="rounded-2xl border border-[#2d7dff]/20 bg-zinc-950/80 p-4">
      <div className="mb-3 flex items-center gap-2 text-[#bafcfc]"><Camera className="h-4 w-4" /><h3 className="font-medium">{label}</h3></div>
      {error ? <p className="mb-3 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs text-rose-300">{error}</p> : null}
      <div className="grid grid-cols-2 gap-3">
        {photos.map((photo) => photo.url ? (
          <button key={photo.id} type="button" onClick={() => onOpen({ url: photo.url!, alt: photo.caption ?? `${label} photo` })} className="group relative aspect-square overflow-hidden rounded-2xl border border-[#2d7dff]/20 bg-black/60 text-left transition hover:border-[#8ffafa]/45" aria-label={`Open ${photo.caption ?? label} full screen`}>
            <Image src={photo.url} alt={photo.caption ?? `${label} photo`} fill className="object-cover transition duration-300 group-hover:scale-[1.03]" unoptimized />
            <span className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/65 text-white backdrop-blur"><Maximize2 className="h-4 w-4" /></span>
          </button>
        ) : null)}
        {photos.length === 0 ? <p className="col-span-2 text-sm text-zinc-500">No photos uploaded yet.</p> : null}
      </div>

      {readOnly ? null : (
        <>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={pending} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#2d7dff]/40 px-4 py-3 text-sm text-[#d9fbff] transition hover:bg-[#2d7dff]/10 disabled:opacity-60"><Upload className="h-4 w-4" />{pending ? "Uploading…" : `Capture / upload ${phase} image`}</button>
        </>
      )}
    </div>
  );
}

/** Full-screen photo viewer shared with the technician Work Page. */
export function PhotoPreview({ preview, onClose }: { preview: PreviewPhoto | null; onClose: () => void }) {
  useEffect(() => {
    if (!preview) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
    };
  }, [preview, onClose]);

  if (!preview) return null;
  return <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/90 p-3 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" aria-label="Field photo preview" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <div className="relative h-[82dvh] w-full max-w-5xl overflow-hidden rounded-3xl border border-[#2d7dff]/40 bg-black shadow-[0_0_40px_rgba(45,125,255,0.24)]">
      <Image src={preview.url} alt={preview.alt} fill className="object-contain" unoptimized priority />
      <button type="button" onClick={onClose} className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white backdrop-blur transition hover:bg-black" aria-label="Close photo preview"><X className="h-5 w-5" /></button>
    </div>
  </div>;
}

export function MediaAccordion({ jobId, beforePhotos, afterPhotos, readOnly }: { jobId: string; beforePhotos: Photo[]; afterPhotos: Photo[]; readOnly?: boolean }) {
  const [preview, setPreview] = useState<PreviewPhoto | null>(null);

  return (
    <>
      <details className="group rounded-3xl border border-[#2d7dff]/30 bg-black/40 p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
          <div className="min-w-0"><p className="text-sm font-medium text-white">Before &amp; After Photos</p><p className="mt-1 text-sm text-zinc-400">Tap any uploaded photo for a full-screen field view.</p></div>
          <div className="flex shrink-0 items-center gap-2"><StatusPill>{beforePhotos.length + afterPhotos.length} uploaded</StatusPill></div>
        </summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <PhotoColumn jobId={jobId} phase="before" photos={beforePhotos} label="Before photos" readOnly={readOnly} onOpen={setPreview} />
          <PhotoColumn jobId={jobId} phase="after" photos={afterPhotos} label="After photos" readOnly={readOnly} onOpen={setPreview} />
        </div>
      </details>

      <PhotoPreview preview={preview} onClose={() => setPreview(null)} />
    </>
  );
}
