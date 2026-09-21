"use client";

import { useState } from "react";

import { AiTextAssist } from "./ai-text-assist";
import { VoiceDictationButton } from "./voice-dictation-button";

export function TextareaWithAI({ name, rows, placeholder, defaultValue, className }: { name: string; rows: number; placeholder?: string; defaultValue?: string; className: string }) {
  const [value, setValue] = useState(defaultValue ?? "");

  return (
    <div>
      <textarea name={name} rows={rows} placeholder={placeholder} value={value} onChange={(event) => setValue(event.target.value)} className={className} />
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <VoiceDictationButton getValue={() => value} setValue={setValue} />
        <AiTextAssist getValue={() => value} setValue={setValue} />
      </div>
    </div>
  );
}
