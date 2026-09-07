"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Camera, Download, FileText, Mail, Trash2 } from "lucide-react";

type ScanPage = {
  id: string;
  dataUrl: string;
  width: number;
  height: number;
};

type PdfObject = { number: number; bytes: Uint8Array };

const encoder = new TextEncoder();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ascii(value: string) {
  return encoder.encode(value);
}

function joinBytes(parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function dataUrlToBytes(dataUrl: string) {
  const encoded = dataUrl.split(",")[1] || "";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("That image could not be opened."));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function compressImage(file: File): Promise<Omit<ScanPage, "id">> {
  const image = await fileToImage(file);
  const maxSide = 1700;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Camera processing is not available in this browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.76), width, height };
}

function makePdfObject(number: number, body: Uint8Array) {
  return { number, bytes: joinBytes([ascii(`${number} 0 obj\n`), body, ascii("\nendobj\n")]) };
}

function buildPdf(pages: ScanPage[]) {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 28;
  const objects: PdfObject[] = [];
  const kids = pages.map((_, index) => `${3 + index * 3} 0 R`).join(" ");

  objects.push(makePdfObject(1, ascii("<< /Type /Catalog /Pages 2 0 R >>")));
  objects.push(makePdfObject(2, ascii(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`)));

  pages.forEach((page, index) => {
    const pageObject = 3 + index * 3;
    const imageObject = pageObject + 1;
    const contentObject = pageObject + 2;
    const jpeg = dataUrlToBytes(page.dataUrl);
    const scale = Math.min((pageWidth - margin * 2) / page.width, (pageHeight - margin * 2) / page.height);
    const drawWidth = page.width * scale;
    const drawHeight = page.height * scale;
    const x = (pageWidth - drawWidth) / 2;
    const y = (pageHeight - drawHeight) / 2;
    const content = ascii(`q\n${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ`);

    objects.push(
      makePdfObject(
        pageObject,
        ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>`),
      ),
    );
    objects.push(
      makePdfObject(
        imageObject,
        joinBytes([
          ascii(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
          jpeg,
          ascii("\nendstream"),
        ]),
      ),
    );
    objects.push(makePdfObject(contentObject, joinBytes([ascii(`<< /Length ${content.length} >>\nstream\n`), content, ascii("\nendstream")])));
  });

  const header = ascii("%PDF-1.4\n%ChillBros\n");
  const offsets: number[] = [0];
  let running = header.length;
  for (const object of objects) {
    offsets[object.number] = running;
    running += object.bytes.length;
  }

  const xrefOffset = running;
  const maxObject = 2 + pages.length * 3;
  const xrefRows = ["0000000000 65535 f "];
  for (let number = 1; number <= maxObject; number += 1) {
    xrefRows.push(`${String(offsets[number] || 0).padStart(10, "0")} 00000 n `);
  }
  const xref = ascii(`xref\n0 ${maxObject + 1}\n${xrefRows.join("\n")}\ntrailer\n<< /Size ${maxObject + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return new Blob([joinBytes([header, ...objects.map((object) => object.bytes), xref])], { type: "application/pdf" });
}

async function blobToBase64(blob: Blob) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("The PDF could not be prepared for email."));
    reader.readAsDataURL(blob);
  });
  return dataUrl.split(",")[1] || "";
}

function slug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "paperwork";
}

export function ScanSendTool({ defaultRecipient }: { defaultRecipient: string }) {
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [documentType, setDocumentType] = useState("Paperwork");
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [subject, setSubject] = useState("Chill Bros scanned paperwork");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const canSend = useMemo(() => pages.length > 0 && emailPattern.test(recipient.trim()) && !busy, [pages.length, recipient, busy]);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setStatus("Preparing scan pages…");
    try {
      const additions: ScanPage[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const compressed = await compressImage(file);
        additions.push({ id: crypto.randomUUID(), ...compressed });
      }
      setPages((current) => [...current, ...additions]);
      setStatus(additions.length ? `${additions.length} page${additions.length === 1 ? "" : "s"} added.` : "No image pages were added.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The page could not be added.");
    }
  }

  function movePage(index: number, direction: -1 | 1) {
    setPages((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removePage(id: string) {
    setPages((current) => current.filter((page) => page.id !== id));
  }

  function filename() {
    return `${slug(documentType)}-${new Date().toISOString().slice(0, 10)}.pdf`;
  }

  function downloadPdf() {
    if (!pages.length) return;
    const blob = buildPdf(pages);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename();
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function sendScan(event: React.FormEvent) {
    event.preventDefault();
    if (!canSend) return;
    setBusy(true);
    setStatus("Building PDF…");
    try {
      const pdf = buildPdf(pages);
      if (pdf.size > 3_300_000) throw new Error("This scan is too large for one email. Send fewer pages at a time.");
      const pdfBase64 = await blobToBase64(pdf);
      setStatus("Sending email…");
      const response = await fetch("/api/scan-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipient.trim(),
          subject: subject.trim(),
          notes: notes.trim(),
          filename: filename(),
          pdfBase64,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The email could not be sent.");
      setStatus(`Sent successfully to ${recipient.trim()}.`);
      setPages([]);
      setNotes("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The email could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-3xl border border-[#2d7dff]/30 bg-black/35 p-4 shadow-[0_0_24px_rgba(45,125,255,0.12)] sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-2xl border border-[#8ffafa]/35 bg-[#2d7dff]/10 p-3"><Camera className="h-5 w-5 text-[#8ffafa]" /></div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8ffafa]">Step 1</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Scan paperwork</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-400">Take a photo of each page or choose existing images. Pages are compressed on the phone before the PDF is created.</p>
          </div>
        </div>

        <label className="flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[#8ffafa]/55 bg-[#2d7dff]/10 px-4 text-sm font-semibold text-white transition hover:bg-[#2d7dff]/20">
          <Camera className="h-5 w-5 text-[#8ffafa]" /> Take photo / add page
          <input
            className="hidden"
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={async (event) => {
              await addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>

        {pages.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {pages.map((page, index) => (
              <article key={page.id} className="overflow-hidden rounded-2xl border border-[#2d7dff]/25 bg-[#020407]">
                <img src={page.dataUrl} alt={`Scanned page ${index + 1}`} className="aspect-[3/4] w-full object-cover" />
                <div className="flex items-center justify-between gap-2 p-2.5">
                  <span className="text-xs font-semibold text-[#d9fbff]">Page {index + 1}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => movePage(index, -1)} disabled={index === 0} className="rounded-lg border border-[#2d7dff]/20 p-2 text-zinc-300 disabled:opacity-25" aria-label="Move page up"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => movePage(index, 1)} disabled={index === pages.length - 1} className="rounded-lg border border-[#2d7dff]/20 p-2 text-zinc-300 disabled:opacity-25" aria-label="Move page down"><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => removePage(page.id)} className="rounded-lg border border-red-400/20 p-2 text-red-300" aria-label="Remove page"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-[#2d7dff]/15 bg-black/25 p-5 text-center text-sm text-zinc-500"><FileText className="mx-auto mb-2 h-6 w-6 text-[#8ffafa]/60" />No pages added yet.</div>
        )}
      </section>

      <form onSubmit={sendScan} className="rounded-3xl border border-[#2d7dff]/30 bg-black/35 p-4 shadow-[0_0_24px_rgba(45,125,255,0.12)] sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-2xl border border-[#8ffafa]/35 bg-[#2d7dff]/10 p-3"><Mail className="h-5 w-5 text-[#8ffafa]" /></div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8ffafa]">Step 2</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Email PDF</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-400">All pages are combined into one PDF attachment and sent through the protected server endpoint.</p>
          </div>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#d9fbff]">Document type
            <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="min-h-12 rounded-xl border border-[#2d7dff]/30 bg-[#020407] px-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-[#8ffafa]/60">
              {['Paperwork','Invoice','Receipt','Work Order','Permit','Contract','Other'].map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#d9fbff]">Recipient email
            <input type="email" required value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="office@example.com" className="min-h-12 rounded-xl border border-[#2d7dff]/30 bg-[#020407] px-3 text-sm font-normal normal-case tracking-normal text-white outline-none placeholder:text-zinc-600 focus:border-[#8ffafa]/60" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#d9fbff]">Subject
            <input value={subject} onChange={(event) => setSubject(event.target.value)} className="min-h-12 rounded-xl border border-[#2d7dff]/30 bg-[#020407] px-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-[#8ffafa]/60" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#d9fbff]">Notes
            <textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Customer, job number, or any notes…" className="rounded-xl border border-[#2d7dff]/30 bg-[#020407] px-3 py-3 text-sm font-normal normal-case tracking-normal text-white outline-none placeholder:text-zinc-600 focus:border-[#8ffafa]/60" />
          </label>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={downloadPdf} disabled={!pages.length || busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#8ffafa]/35 bg-black/35 px-4 text-sm font-semibold text-[#d9fbff] disabled:opacity-35"><Download className="h-4 w-4" />Download PDF</button>
          <button type="submit" disabled={!canSend} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#8ffafa]/60 bg-[#2d7dff]/25 px-4 text-sm font-bold text-white shadow-[0_0_18px_rgba(45,125,255,0.2)] transition hover:bg-[#2d7dff]/35 disabled:cursor-not-allowed disabled:opacity-35"><Mail className="h-4 w-4 text-[#8ffafa]" />{busy ? "Sending…" : `Send ${pages.length || ""} page${pages.length === 1 ? "" : "s"}`}</button>
        </div>

        {status ? <p className="mt-4 rounded-xl border border-[#2d7dff]/20 bg-[#07152c]/45 px-3 py-2.5 text-sm text-[#d9fbff]">{status}</p> : null}
        <p className="mt-4 text-xs leading-5 text-zinc-500">Email credentials remain server-side. The scan page is available only to signed-in Chill Bros staff.</p>
      </form>
    </div>
  );
}
