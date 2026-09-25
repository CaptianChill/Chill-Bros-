"use client";

import { Mic, MicOff } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionErrorEventLike = { error: string };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const globalWindow = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
  return globalWindow.SpeechRecognition ?? globalWindow.webkitSpeechRecognition ?? null;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access denied. Allow the mic for this site in your browser settings.",
  "service-not-allowed": "Microphone access denied. Allow the mic for this site in your browser settings.",
  "no-speech": "Didn't catch any speech. Try again.",
  "audio-capture": "No microphone found.",
  network: "Network error during dictation. Try again.",
  aborted: "",
};

const noSubscribe = () => () => {};

export function VoiceDictationButton({ getValue, setValue, disabled, tone = "dark" }: { getValue: () => string; setValue: (next: string) => void; disabled?: boolean; tone?: "dark" | "light" }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Read after hydration: the server can't know, so reading it during render
  // made server and client HTML disagree (hydration error).
  const supported = useSyncExternalStore(noSubscribe, () => Boolean(getSpeechRecognitionCtor()), () => false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef("");
  const getValueRef = useRef(getValue);
  const setValueRef = useRef(setValue);

  useEffect(() => {
    getValueRef.current = getValue;
    setValueRef.current = setValue;
  });

  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += transcript;
        else interim += transcript;
      }
      if (finalText.trim()) baseTextRef.current = [baseTextRef.current.trim(), finalText.trim()].filter(Boolean).join(" ");
      setValueRef.current([baseTextRef.current, interim.trim()].filter(Boolean).join(" "));
    };
    recognition.onerror = (event) => {
      const message = ERROR_MESSAGES[event.error] ?? "Dictation error. Please retry.";
      if (message) setError(message);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    return () => {
      try { recognition.stop(); } catch { /* already stopped */ }
    };
  }, []);

  if (!supported) return null;

  function toggle() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) {
      try { recognition.stop(); } catch { /* already stopping */ }
      setListening(false);
      return;
    }
    setError(null);
    baseTextRef.current = getValueRef.current();
    try {
      recognition.start();
      setListening(true);
    } catch {
      /* engine still shutting down from a rapid stop/start; onend will re-enable the button */
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition disabled:opacity-40 ${tone === "light" ? (listening ? "border-[#B42318] bg-[#FDECEA] font-semibold text-[#B42318]" : "border-[#1557B0] bg-white font-semibold text-[#1557B0]") : listening ? "border-rose-400/50 bg-rose-500/10 text-rose-100" : "border-[#2d7dff]/25 text-[#d9fbff] hover:border-[#8ffafa]/45"}`}
      >
        {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
        {listening ? "Stop dictation" : "Dictate"}
      </button>
      {error ? <span className={tone === "light" ? "text-xs font-semibold text-[#B42318]" : "text-xs text-rose-300"}>{error}</span> : null}
    </div>
  );
}
