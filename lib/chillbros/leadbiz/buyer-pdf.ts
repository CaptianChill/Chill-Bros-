// Lead Buyers call sheet as a PDF: "print" draws empty boxes to tick by pen; "fill" adds a real
// checkbox and a notes field on every row (fillable in Adobe, Edge, Chrome or Preview).
import { PDFBool, PDFDocument, PDFName, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

export type SheetRow = { license: string; trade: string; name: string; phone: string | null; address: string | null; contact: string | null; done?: boolean; result?: string | null };

const W = 612, H = 792, M = 32, ROW = 15;
const COLS = { box: M, name: M + 24, contact: M + 210, phone: M + 312, address: M + 386, notes: M + 470 };
const INK = rgb(0.06, 0.1, 0.2), MUTED = rgb(0.4, 0.45, 0.52), LINE = rgb(0.82, 0.85, 0.9), ACCENT = rgb(0.11, 0.25, 0.82);

// Standard PDF fonts only cover Latin-1; strip anything else so drawing never throws.
const clean = (s: string | null | undefined) => String(s ?? "").normalize("NFKD").replace(/[^\x20-\x7E\xA0-\xFF]/g, "").trim();
function fit(font: PDFFont, text: string, size: number, width: number) {
  let t = clean(text);
  if (font.widthOfTextAtSize(t, size) <= width) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > width) t = t.slice(0, -1);
  return `${t}...`;
}

export async function buildBuyerSheet(rows: SheetRow[], kind: "print" | "fill", meta: { title: string; subtitle: string; script?: Record<string, string> }) {
  const doc = await PDFDocument.create();
  doc.setTitle(meta.title);
  doc.setAuthor("Chill Professionals LLC");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const form = kind === "fill" ? doc.getForm() : null;
  let page: PDFPage = doc.addPage([W, H]);
  let y = 0, pageNo = 0, i = 0;

  const header = (trade?: string) => {
    pageNo++;
    page.drawText(fit(bold, meta.title, 14, W - 2 * M - 60), { x: M, y: H - M - 10, size: 14, font: bold, color: INK });
    page.drawText(`Page ${pageNo}`, { x: W - M - 40, y: H - M - 10, size: 8, font, color: MUTED });
    page.drawText(fit(font, meta.subtitle, 8, W - 2 * M), { x: M, y: H - M - 24, size: 8, font, color: MUTED });
    y = H - M - 44;
    if (trade) tradeHeader(trade, true);
  };
  const columns = () => {
    const labels: [number, string][] = [[COLS.box, "Done"], [COLS.name, "Company"], [COLS.contact, "Contact"], [COLS.phone, "Phone"], [COLS.address, "City / area"], [COLS.notes, "Result / notes"]];
    for (const [x, l] of labels) page.drawText(l, { x, y, size: 7, font: bold, color: MUTED });
    y -= 4;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: LINE });
    y -= ROW - 4;
  };
  const tradeHeader = (trade: string, cont = false) => {
    y -= 4;
    page.drawText(`${trade}${cont ? " (continued)" : ""}`, { x: M, y, size: 11, font: bold, color: ACCENT });
    y -= 12;
    const script = !cont ? meta.script?.[trade] : undefined;
    if (script) {
      const words = clean(`Script: "${script}"`).split(" ");
      let line = "";
      for (const w of words) {
        if (font.widthOfTextAtSize(`${line} ${w}`, 7) > W - 2 * M) { page.drawText(line, { x: M, y, size: 7, font, color: MUTED }); y -= 9; line = w; }
        else line = line ? `${line} ${w}` : w;
      }
      if (line) { page.drawText(line, { x: M, y, size: 7, font, color: MUTED }); y -= 12; }
    }
    columns();
  };

  header();
  let current = "";
  for (const r of rows) {
    if (r.trade !== current) {
      if (y < M + 90) { page = doc.addPage([W, H]); header(); }
      current = r.trade;
      tradeHeader(current);
    }
    if (y < M + ROW) { page = doc.addPage([W, H]); header(current); }
    const city = clean(r.address).split(",").slice(-1)[0]?.replace(/\s+\d{5}(-\d{4})?$/, "").replace(/\s+TX$/i, "").trim() ?? "";
    if (form) {
      const box = form.createCheckBox(`p${pageNo}.done_${i}`);
      box.addToPage(page, { x: COLS.box + 1, y: y - 2, width: 9, height: 9, borderColor: INK, borderWidth: 0.8 });
      if (r.done) box.check();
      const note = form.createTextField(`p${pageNo}.note_${i}`);
      if (r.result) note.setText(clean(r.result));
      note.addToPage(page, { x: COLS.notes, y: y - 3, width: W - M - COLS.notes, height: 11, borderColor: LINE, borderWidth: 0.5 });
    } else {
      page.drawRectangle({ x: COLS.box + 1, y: y - 2, width: 9, height: 9, borderColor: INK, borderWidth: 0.8 });
      if (r.done) page.drawText("X", { x: COLS.box + 2.6, y: y - 0.6, size: 8, font: bold, color: INK });
      if (r.result) page.drawText(fit(font, r.result, 7, W - M - COLS.notes), { x: COLS.notes, y, size: 7, font, color: MUTED });
      page.drawLine({ start: { x: COLS.notes, y: y - 3 }, end: { x: W - M, y: y - 3 }, thickness: 0.4, color: LINE });
    }
    page.drawText(fit(bold, r.name, 8, COLS.contact - COLS.name - 6), { x: COLS.name, y, size: 8, font: bold, color: INK });
    page.drawText(fit(font, r.contact ?? "", 7.5, COLS.phone - COLS.contact - 6), { x: COLS.contact, y, size: 7.5, font, color: INK });
    page.drawText(r.phone ? clean(r.phone) : "look up", { x: COLS.phone, y, size: 8, font: r.phone ? bold : font, color: r.phone ? INK : MUTED });
    page.drawText(fit(font, city, 7.5, COLS.notes - COLS.address - 6), { x: COLS.address, y, size: 7.5, font, color: INK });
    y -= ROW;
    i++;
  }
  if (form) {
    // Fields are grouped per page (p<page>.done_<row>): pdf-lib scans siblings on every create, so flat
    // names made 4,800 fields take ~45s. Also let the viewer draw field appearances.
    form.acroForm.dict.set(PDFName.of("NeedAppearances"), PDFBool.True);
    form.acroForm.dict.set(PDFName.of("DA"), doc.context.obj("/Helv 7 Tf 0 g") as never);
    return doc.save({ updateFieldAppearances: false });
  }
  return doc.save();
}
