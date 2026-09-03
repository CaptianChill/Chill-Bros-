"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Camera, Upload } from "lucide-react";

import { uploadJobPhotoAction } from "@/lib/chillbros/mutations";
import { StatusPill } from "@/components/status-pill";

type Photo = { id: string; caption: string | null; url: string | null };

function PhotoColumn({ jobId, phase, photos, label, readOnly }: { jobId: string; phase: "before" | "after"; photos: Photo[]; label: string; readOnly?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const result = await uploadJobPhotoAction(jobId, phase, file);
      if (!result.ok) setError(result.error);
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  return (
    <div className="rounded-2xl border border-[#00f0f0]/20 bg-zinc-950/80 p-4">
      <div className="mb-3 flex items-center gap-2 text-[#bafcfc]">
        <Camera className="h-4 w-4" />
        <h3 className="font-medium">{label}</h3>
      </div>
      {error ? <p className="mb-3 text-xs text-rose-300">{error}</p> : null}
      <div className="grid grid-cols-2 gap-3">
        {photos.map((photo) =>
          photo.url ? (
            <div key={photo.id} className="relative aspect-square overflow-hidden rounded-2xl border border-[#00f0f0]/20 bg-black/60">
              <Image src={photo.url} alt={photo.caption ?? `${label} photo`} fill className="object-cover" unoptimized />
            </div>
          ) : null,
        )}
        {photos.length === 0 ? <p className="col-span-2 text-sm text-zinc-500">No photos uploaded yet.</p> : null}
      </div>
      {readOnly ? null : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#00f0f0]/40 px-4 py-3 text-sm text-[#defefe] transition hover:bg-[#00f0f0]/10 disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {pending ? "Uploading…" : `Capture / upload ${phase} image`}
          </button>
        </>
      )}
    </div>
  );
}

export function MediaAccordion({ jobId, beforePhotos, afterPhotos, readOnly }: { jobId: string; beforePhotos: Photo[]; afterPhotos: Photo[]; readOnly?: boolean }) {
  return (
    <details className="group rounded-3xl border border-[#00f0f0]/30 bg-black/40 p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white">Before &amp; After Photos</p>
          <p className="mt-1 text-sm text-zinc-400">Collapsed by default for mobile-friendly service entry.</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill>{beforePhotos.length + afterPhotos.length} uploaded</StatusPill>
        </div>
      </summary>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PhotoColumn jobId={jobId} phase="before" photos={beforePhotos} label="Before photos" readOnly={readOnly} />
        <PhotoColumn jobId={jobId} phase="after" photos={afterPhotos} label="After photos" readOnly={readOnly} />
      </div>
    </details>
  );
}
