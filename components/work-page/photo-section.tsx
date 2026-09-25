"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus } from "lucide-react";

import { PhotoPreview, type PreviewPhoto } from "@/components/media-accordion";
import { downscaleImage } from "@/lib/chillbros/client-image";
import { uploadJobPhotoAction } from "@/lib/chillbros/mutations";

type Photo = { id: string; caption: string | null; url: string | null };

/**
 * Before or after photos for the Work Page: take or pick several at once,
 * thumbnail grid, full-screen preview. Same private bucket + signed URLs and
 * the same upload action as the rest of the app.
 */
export function PhotoSection({ jobId, phase, photos, canUpload }: { jobId: string; phase: "before" | "after"; photos: Photo[]; canUpload: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewPhoto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const title = phase === "before" ? "Before photos" : "After photos";
  const close = useCallback(() => setPreview(null), []);

  const upload = (files: FileList | null) => {
    const list = Array.from(files ?? []).slice(0, 10);
    if (!list.length) return;
    setError(null);
    startTransition(async () => {
      const failures: string[] = [];
      for (const [index, file] of list.entries()) {
        setProgress(`Uploading ${index + 1} of ${list.length}…`);
        const result = await uploadJobPhotoAction(jobId, phase, await downscaleImage(file));
        if (!result.ok) failures.push(result.error);
      }
      setProgress(null);
      if (failures.length) setError(failures[0]);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    });
  };

  return (
    <section id={`${phase}-photos`} aria-labelledby={`${phase}-photos-title`} className="cb-work-card scroll-mt-24 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 id={`${phase}-photos-title`} className="text-lg font-bold">{title}</h2>
        <span className="text-sm font-semibold text-[#2B3F5C]">{photos.length}</span>
      </div>
      {photos.length ? (
        <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo, index) =>
            photo.url ? (
              <li key={photo.id}>
                <button type="button" onClick={() => setPreview({ url: photo.url!, alt: photo.caption ?? `${title} ${index + 1}` })} className="block aspect-square w-full overflow-hidden rounded-lg border border-[#C7D3E2] bg-[#F8FAFD]" aria-label={`Open ${title.toLowerCase()} ${index + 1} full screen`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from the private bucket */}
                  <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              </li>
            ) : null,
          )}
        </ul>
      ) : (
        <p className="mt-1 text-sm font-medium text-[#2B3F5C]">No {phase} photos yet.</p>
      )}
      {canUpload ? (
        <>
          <input id={`${phase}-photos-input`} ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => upload(event.target.files)} />
          <button type="button" disabled={pending} onClick={() => inputRef.current?.click()} className="mt-2.5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#1557B0] bg-[#F8FAFD] px-3 font-semibold text-[#1557B0] disabled:opacity-60">
            {pending ? <ImagePlus className="h-5 w-5" aria-hidden="true" /> : <Camera className="h-5 w-5" aria-hidden="true" />}
            {progress ?? `Take / add ${phase} photos`}
          </button>
        </>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-[#B42318]">{error}</p> : null}
      <PhotoPreview preview={preview} onClose={close} />
    </section>
  );
}
