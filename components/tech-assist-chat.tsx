"use client";

import { Send, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";

import { askTechAssistAction } from "@/lib/chillbros/tech-assist-ai";

type Message = { role: "user" | "assistant"; content: string };

const STARTERS = ["What should I check first?", "Has this unit had this problem before?", "Walk me through diagnosing this complaint"];

export function TechAssistChat({ jobId }: { jobId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ask = (text: string) => {
    const q = text.trim();
    if (!q || pending) return;
    setError(null);
    const history = messages;
    setMessages([...history, { role: "user", content: q }]);
    setQuestion("");
    startTransition(async () => {
      const result = await askTechAssistAction(jobId, q, history);
      if (!result.ok) { setError(result.error); setMessages(history); setQuestion(q); return; }
      setMessages([...history, { role: "user", content: q }, { role: "assistant", content: result.answer }]);
    });
  };

  return <div className="space-y-3 text-left">
    {messages.length === 0 ? <div className="grid gap-2 sm:grid-cols-3">{STARTERS.map((s) => <button key={s} type="button" onClick={() => ask(s)} disabled={pending} className="rounded-xl border border-[#2d7dff]/25 bg-black/40 p-3 text-left text-sm text-[#d9fbff] disabled:opacity-50">{s}</button>)}</div> : null}
    <div className="space-y-2">
      {messages.map((m, i) => <div key={i} className={`rounded-xl border p-3 text-sm leading-6 ${m.role === "user" ? "ml-8 border-[#2d7dff]/30 bg-[#2d7dff]/10 text-white" : "mr-4 border-[#8ffafa]/20 bg-black/50 text-zinc-200"}`}>
        {m.role === "assistant" ? <p className="mb-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-[#8ffafa]"><Sparkles className="h-3 w-3" />Claude</p> : null}
        <p className="whitespace-pre-wrap">{m.content}</p>
      </div>)}
      {pending ? <p className="mr-4 rounded-xl border border-[#8ffafa]/20 bg-black/50 p-3 text-sm text-zinc-400">Claude is reading this job…</p> : null}
    </div>
    {error ? <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
    <form onSubmit={(e) => { e.preventDefault(); ask(question); }} className="flex gap-2" data-no-draft>
      <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about this job…" className="min-w-0 flex-1 rounded-xl border border-[#2d7dff]/25 bg-black px-3 py-2.5 text-white" />
      <button type="submit" disabled={pending || question.trim().length < 3} className="inline-flex items-center gap-1.5 rounded-xl border border-[#8ffafa]/40 bg-[#2d7dff]/15 px-4 py-2.5 text-sm text-white disabled:opacity-50"><Send className="h-4 w-4" />Ask</button>
    </form>
    <p className="text-[11px] text-zinc-500">Claude sees this job, its equipment and past repairs on this unit. Double-check specs against the data plate.</p>
  </div>;
}
