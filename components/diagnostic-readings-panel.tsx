import { saveDiagnosticReadingAction } from "@/lib/chillbros/diagnostic-readings";

type Reading = { id: string; category: string; readings: Record<string, string>; notes: string | null; createdAt: string; technicianName: string };

const fields = [["suction","Suction PSI"],["discharge","Discharge PSI"],["superheat","Superheat °F"],["subcooling","Subcooling °F"],["boxTemp","Box / return temp"],["ambientTemp","Ambient temp"],["deltaT","Delta T"],["voltage","Voltage"],["compressorAmps","Compressor amps"],["fanAmps","Fan amps"],["gasPressure","Gas pressure"],["flameSignal","Flame signal"]] as const;

const TONES = {
  dark: {
    input: "min-h-10 rounded-xl border border-[#2d7dff]/20 bg-black px-3 text-sm text-white",
    form: "rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4",
    textarea: "mt-2 w-full rounded-xl border border-[#2d7dff]/20 bg-black px-3 py-2 text-sm text-white",
    button: "mt-3 w-full rounded-xl border border-[#8ffafa]/40 bg-[#2d7dff]/15 px-4 py-3 font-semibold text-[#d9fbff]",
    entry: "rounded-xl border border-[#2d7dff]/15 bg-black/35 p-3",
    title: "font-medium text-white",
    muted: "text-xs text-zinc-500",
    chip: "rounded-lg border border-[#2d7dff]/15 px-2 py-1 text-xs text-zinc-300",
    notes: "mt-2 text-sm text-zinc-300",
    empty: "text-sm text-zinc-500",
  },
  // Solid, high-contrast variant for the technician Work Page cards.
  light: {
    input: "min-h-11 min-w-0 rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] px-3 text-base font-medium text-[#0A1A33] placeholder:text-[#5B6B82]",
    form: "",
    textarea: "mt-2 w-full rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] px-3 py-2 text-base font-medium text-[#0A1A33] placeholder:text-[#5B6B82]",
    button: "mt-2 min-h-12 w-full rounded-xl border border-[#1557B0] bg-white px-4 font-semibold text-[#1557B0]",
    entry: "rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] p-2.5",
    title: "font-bold capitalize text-[#0A1A33]",
    muted: "text-[12px] font-medium text-[#5B6B82]",
    chip: "rounded-lg border border-[#C7D3E2] bg-white px-2 py-1 text-[13px] font-medium text-[#0A1A33]",
    notes: "mt-1.5 text-sm font-medium text-[#2B3F5C]",
    empty: "text-sm font-medium text-[#2B3F5C]",
  },
} as const;

export function DiagnosticReadingsPanel({ jobId, readings, tone = "dark", showHistory = true, submitLabel = "Save readings to job & equipment", notesPlaceholder = "Diagnostic notes / interpretation" }: { jobId: string; readings: Reading[]; tone?: keyof typeof TONES; showHistory?: boolean; submitLabel?: string; notesPlaceholder?: string }) {
  const t = TONES[tone];
  return (
    <div className="space-y-4">
      <form data-no-draft action={saveDiagnosticReadingAction} className={t.form}>
        <input type="hidden" name="jobId" value={jobId} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <select name="category" aria-label="Equipment category" defaultValue="refrigeration" className={`${t.input} col-span-2 sm:col-span-1`}>
            <option value="refrigeration">Refrigeration</option>
            <option value="hvac">HVAC</option>
            <option value="cooking">Cooking equipment</option>
            <option value="electrical">Electrical</option>
            <option value="general">General</option>
          </select>
          {fields.map(([name, label]) => <input key={name} name={name} aria-label={label} placeholder={label} className={t.input} />)}
        </div>
        <textarea name="notes" rows={2} aria-label="Reading notes" placeholder={notesPlaceholder} className={t.textarea} />
        <button className={t.button}>{submitLabel}</button>
      </form>
      {showHistory ? (
        <div className="space-y-2">
          {readings.length ? readings.map((entry) => (
            <div key={entry.id} className={t.entry}>
              <div className="flex justify-between gap-3"><p className={t.title}>{entry.category.replace(/_/g, " ")}</p><p className={t.muted}>{new Date(entry.createdAt).toLocaleString("en-US", { timeZone: "America/Chicago" })}</p></div>
              <p className={`mt-1 ${t.muted}`}>{entry.technicianName}</p>
              <div className="mt-2 flex flex-wrap gap-2">{Object.entries(entry.readings).map(([key, value]) => <span key={key} className={t.chip}>{key}: {value}</span>)}</div>
              {entry.notes ? <p className={t.notes}>{entry.notes}</p> : null}
            </div>
          )) : <p className={t.empty}>No structured readings saved yet.</p>}
        </div>
      ) : null}
    </div>
  );
}
