"use client";

import { Mic, Send, Square, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { askChillAction } from "@/lib/chillbros/chill-assistant";

type Pose = "idle" | "greeting" | "listening" | "thinking" | "talking" | "success";
type Message = { role: "user" | "assistant"; content: string };

const POSES: Pose[] = ["idle", "greeting", "listening", "thinking", "talking", "success"];
const src = (pose: Pose) => `/chill-pros-mascot/${pose}.webp`;
const MAX_RECORD_MS = 30000;
// A few milliseconds of silence, played on the first tap so phones allow Chill's voice later.
const SILENT_AUDIO = "data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";

// First sentence on its own so Chill starts talking sooner; the rest as one part.
export function splitForSpeech(answer: string) {
  const clean = answer.replace(/\s+/g, " ").trim();
  const match = clean.match(/^(.{20,220}?[.!?])\s+(.+)$/);
  return match ? [match[1], match[2]] : [clean];
}

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export function ChillAssistant({ firstName }: { firstName: string }) {
  const [open, setOpen] = useState(false);
  const [pose, setPose] = useState<Pose>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [voiceSource, setVoiceSource] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

  // Preload every pose so switching never flickers.
  useEffect(() => { for (const p of POSES) { const img = new Image(); img.src = src(p); } }, []);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages, busy]);

  const unlockAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      // Only real answers (blob URLs) drive the talking pose, never the silent unlock clip.
      const isVoice = () => audio.src.startsWith("blob:");
      audio.addEventListener("play", () => { if (isVoice()) setPose("talking"); });
      // When one part of the answer finishes, the next part plays straight away (no idle flicker).
      audio.addEventListener("ended", () => { if (isVoice()) void playNextRef.current(); });
      audioRef.current = audio;
      audio.src = SILENT_AUDIO;
      void audio.play().catch(() => undefined);
    }
  }, []);

  // Answer audio plays as a short queue of parts: the first sentence starts while the rest is still being voiced.
  const queueRef = useRef<Promise<string | null>[]>([]);
  const speakRunRef = useRef(0);
  const playNextRef = useRef<() => Promise<void>>(async () => undefined);
  playNextRef.current = async () => {
    const run = speakRunRef.current;
    const next = queueRef.current.shift();
    if (!next) { setPose((p) => (p === "talking" ? "idle" : p)); return; }
    const url = await next;
    if (run !== speakRunRef.current) return;
    if (!url) { await playNextRef.current(); return; }
    const audio = audioRef.current!;
    if (audio.src.startsWith("blob:")) URL.revokeObjectURL(audio.src);
    audio.src = url;
    try { await audio.play(); } catch { setPose("idle"); setError("Your phone blocked the voice. Tap the speaker button, or read the answer above."); }
  };

  const stopSpeaking = useCallback(() => {
    speakRunRef.current += 1;
    queueRef.current = [];
    audioRef.current?.pause();
    setPose((p) => (p === "talking" ? "idle" : p));
  }, []);

  const speak = useCallback(async (answer: string) => {
    if (!voiceOn) { setPose("success"); window.setTimeout(() => setPose((p) => (p === "success" ? "idle" : p)), 1400); return; }
    if (!audioRef.current) unlockAudio();
    const run = ++speakRunRef.current;
    const fetchClip = async (part: string) => {
      const response = await fetch("/api/voice/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: part }) }).catch(() => null);
      if (!response?.ok) return null;
      const voice = response.headers.get("X-Chill-Voice");
      const model = response.headers.get("X-Chill-Voice-Model");
      const reason = response.headers.get("X-Chill-Voice-Reason");
      if (voice) setVoiceSource(voice === "elevenlabs" ? `BOODA voice${model && !model.startsWith("eleven_v3") ? " (Turbo)" : " (v3)"}` : `Backup voice${reason ? ` — ${reason}` : ""}`);
      return URL.createObjectURL(await response.blob());
    };
    // Voice all parts at the same time; play them in order.
    queueRef.current = splitForSpeech(answer).map(fetchClip);
    const first = queueRef.current[0];
    await playNextRef.current();
    if (run === speakRunRef.current && first && !(await first)) {
      setError("Chill's voice is unavailable right now. The answer is shown above.");
    }
  }, [voiceOn, unlockAudio]);

  const ask = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q) return;
    setError(null);
    stopSpeaking();
    const history = messagesRef.current;
    setMessages([...history, { role: "user", content: q }]);
    setBusy(true);
    setPose("thinking");
    const result = await askChillAction(q, history);
    setBusy(false);
    if (!result.ok) { setError(result.error); setPose("idle"); return; }
    setMessages([...history, { role: "user", content: q }, { role: "assistant", content: result.answer }]);
    await speak(result.answer);
  }, [speak, stopSpeaking]);

  const stopRecording = useCallback(() => {
    if (stopTimerRef.current) { window.clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    unlockAudio();
    stopSpeaking();
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("This browser can't record audio. Type your question instead."); return; }
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setError("Microphone access was blocked. Allow the microphone for this site, or type your question."); return; }
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      const type = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      if (blob.size < 1200) { setPose("idle"); setError("I didn't hear anything. Tap the mic and speak, then tap again."); return; }
      setPose("thinking");
      setBusy(true);
      const form = new FormData();
      form.append("audio", blob, `chill.${type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm"}`);
      const response = await fetch("/api/voice/transcribe", { method: "POST", body: form }).catch(() => null);
      const payload = response ? await response.json().catch(() => ({})) : {};
      setBusy(false);
      if (!response?.ok || !payload?.text) { setPose("idle"); setError(payload?.error ?? "I couldn't hear that. Try again."); return; }
      await ask(String(payload.text));
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    setPose("listening");
    stopTimerRef.current = window.setTimeout(stopRecording, MAX_RECORD_MS);
  }, [ask, stopRecording, stopSpeaking, unlockAudio]);

  const openPanel = () => {
    unlockAudio();
    setOpen(true);
    setPose("greeting");
    window.setTimeout(() => setPose((p) => (p === "greeting" ? "idle" : p)), 1800);
  };
  const closePanel = () => { stopRecording(); stopSpeaking(); setOpen(false); setPose("idle"); };

  const statusText = recording ? "Listening… tap the square when you're done" : busy ? "Thinking…" : pose === "talking" ? "Speaking…" : "Tap the mic and ask me anything";

  return <>
    {!open ? (
      <button type="button" onClick={openPanel} aria-label="Talk to Chill, the Chill Pros assistant" className="chill-launcher fixed bottom-[calc(92px+env(safe-area-inset-bottom))] right-3 z-40 h-[76px] w-[76px] rounded-full border-2 border-white bg-[#1B3FD0]/90 shadow-[0_8px_24px_rgba(4,28,78,0.35)] lg:bottom-6 lg:right-6 lg:h-[88px] lg:w-[88px]">
        <img src={src("idle")} alt="" className="chill-bob h-full w-full object-contain p-1" />
      </button>
    ) : null}

    {open ? (
      <section role="dialog" aria-label="Chill, the Chill Pros assistant" className="cb-new fixed inset-x-2 bottom-[calc(88px+env(safe-area-inset-bottom))] z-50 flex max-h-[min(78dvh,640px)] flex-col overflow-hidden rounded-3xl border border-white bg-white/95 text-[#0a1a33] shadow-[0_18px_48px_rgba(4,28,78,0.4)] backdrop-blur-xl lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[400px]">
        <div className="flex items-center gap-3 border-b border-[#0a1a33]/10 bg-gradient-to-b from-[#e8f0ff] to-white px-3 pt-2">
          <div className="relative h-[112px] w-[112px] shrink-0">
            <img src={src(pose)} alt={`Chill is ${pose === "idle" ? "ready" : pose}`} className={`h-full w-full object-contain ${pose === "idle" ? "chill-bob" : pose === "talking" ? "chill-talk" : pose === "greeting" ? "chill-greet" : ""}`} />
          </div>
          <div className="min-w-0 flex-1 pb-2">
            <p className="text-lg font-bold leading-tight">Chill</p>
            <p className="text-xs text-[#2b3f5c]" aria-live="polite">{statusText}</p>
            {voiceSource ? <p className="mt-0.5 break-words text-[10px] leading-snug text-[#1B3FD0]/80">{voiceSource}</p> : null}
          </div>
          <div className="flex shrink-0 gap-1 self-start pt-1">
            <button type="button" onClick={() => { if (voiceOn) stopSpeaking(); setVoiceOn(!voiceOn); }} aria-label={voiceOn ? "Turn Chill's voice off" : "Turn Chill's voice on"} className="rounded-full p-2 text-[#1B3FD0] hover:bg-[#1B3FD0]/10">{voiceOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}</button>
            <button type="button" onClick={closePanel} aria-label="Close Chill" className="rounded-full p-2 text-[#2b3f5c] hover:bg-[#0a1a33]/10"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div ref={listRef} className="min-h-[96px] flex-1 space-y-2 overflow-y-auto px-3 py-3">
          {messages.length === 0 ? <div className="space-y-2">
            <p className="rounded-2xl bg-[#eef3ff] px-3 py-2 text-sm">Hi {firstName}. Ask me about today's jobs, who owes us money, a customer, or any HVAC or refrigeration question.</p>
            <div className="grid grid-cols-2 gap-2">{["What needs my attention today?", "Who has overdue invoices?", "Which calls are unassigned?", "Walk-in cooler not cooling: where do I start?"].map((s) => <button key={s} type="button" disabled={busy || recording} onClick={() => { unlockAudio(); void ask(s); }} className="rounded-xl border border-[#1B3FD0]/20 bg-white px-2.5 py-2 text-left text-xs font-medium text-[#1B3FD0] disabled:opacity-50">{s}</button>)}</div>
          </div> : messages.map((m, i) => <p key={i} className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6 ${m.role === "user" ? "ml-auto bg-[#1B3FD0] text-white" : "bg-[#eef3ff]"}`}>{m.content}</p>)}
          {error ? <p role="alert" className="rounded-xl border border-[#f5b5b0] bg-[#fef2f1] px-3 py-2 text-xs text-[#b42318]">{error}</p> : null}
        </div>

        <div className="flex items-center gap-2 border-t border-[#0a1a33]/10 p-2.5">
          <button type="button" onClick={() => (recording ? stopRecording() : void startRecording())} disabled={busy} aria-label={recording ? "Stop recording" : "Talk to Chill"} className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-50 ${recording ? "animate-pulse bg-[#e3261c]" : "bg-[#1B3FD0]"}`}>{recording ? <Square className="h-5 w-5" /> : <Mic className="h-6 w-6" />}</button>
          <form className="flex min-w-0 flex-1 gap-2" data-no-draft onSubmit={(e) => { e.preventDefault(); unlockAudio(); const q = text; setText(""); void ask(q); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} disabled={busy || recording} placeholder="Or type a question…" aria-label="Type a question for Chill" className="min-w-0 flex-1 rounded-full border border-[#c7d3e2] bg-[#f8fafd] px-3.5 py-2.5 text-sm text-[#0a1a33]" />
            <button type="submit" disabled={busy || recording || text.trim().length < 2} aria-label="Send" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1B3FD0]/10 text-[#1B3FD0] disabled:opacity-40"><Send className="h-5 w-5" /></button>
          </form>
        </div>
      </section>
    ) : null}
  </>;
}
