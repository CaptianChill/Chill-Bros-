"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-lg space-y-4 p-6 text-white"><h1 className="text-xl">Field Notes could not load</h1><p>Your submitted notes are not removed. Check your connection and retry. If this continues, contact the office.</p><button onClick={reset} className="rounded-xl bg-blue-700 p-3">Retry</button><a href="/sign-in?next=/field-notes" className="block underline">Sign in again</a></main>;
}
