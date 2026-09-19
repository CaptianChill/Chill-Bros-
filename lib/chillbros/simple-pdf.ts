import "server-only";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LEFT = 48;
const TOP = 744;
const LINE_HEIGHT = 13;
const LINES_PER_PAGE = 49;
const WRAP_AT = 88;

function ascii(value: string) {
  return value
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, "?");
}

function escapePdfText(value: string) {
  return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapLine(value: string) {
  const source = ascii(value).trimEnd();
  if (!source) return [""];
  const indent = source.match(/^\s*/)?.[0] ?? "";
  const words = source.trim().split(/\s+/);
  const lines: string[] = [];
  let current = indent;
  for (const word of words) {
    const candidate = current.trim() ? `${current} ${word}` : `${indent}${word}`;
    if (candidate.length > WRAP_AT && current.trim()) {
      lines.push(current);
      current = `${indent}${word}`;
    } else {
      current = candidate;
    }
  }
  if (current.length) lines.push(current);
  return lines;
}

export function buildTextPdf(sourceLines: string[]) {
  const wrapped = sourceLines.flatMap(wrapLine);
  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += LINES_PER_PAGE) pages.push(wrapped.slice(i, i + LINES_PER_PAGE));
  if (!pages.length) pages.push(["No content"]);

  const pageObjectIds = pages.map((_, index) => 3 + index * 2);
  const contentObjectIds = pages.map((_, index) => 4 + index * 2);
  const fontObjectId = 3 + pages.length * 2;
  const objects = new Map<number, string>();

  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(2, `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);

  pages.forEach((lines, index) => {
    const pageId = pageObjectIds[index];
    const contentId = contentObjectIds[index];
    objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    const commands = ["BT", "/F1 9 Tf", `${LEFT} ${TOP} Td`];
    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) commands.push(`0 -${LINE_HEIGHT} Td`);
      commands.push(`(${escapePdfText(line)}) Tj`);
    });
    commands.push("ET");
    const stream = `${commands.join("\n")}\n`;
    objects.set(contentId, `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}endstream`);
  });
  objects.set(fontObjectId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const maxObjectId = fontObjectId;
  let pdf = "%PDF-1.4\n% Chill Pros Revenue Radar\n";
  const offsets: number[] = [0];
  for (let id = 1; id <= maxObjectId; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, "ascii");
    pdf += `${id} 0 obj\n${objects.get(id) ?? "<<>>"}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${maxObjectId + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let id = 1; id <= maxObjectId; id += 1) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${maxObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "ascii");
}
