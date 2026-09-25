// Browser-only: shrink a phone photo before it is sent to a server action.
// Phone cameras produce 2-8MB files; server actions accept a few MB, and a
// 1600px JPEG is plenty for field proof and receipts.

const MAX_EDGE = 1600;
const QUALITY = 0.82;

export async function downscaleImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 900 * 1024) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    // Unsupported format in this browser: send the original and let the
    // server's type/size checks answer.
    return file;
  }
}
