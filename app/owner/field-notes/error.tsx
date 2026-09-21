"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-lg space-y-4 p-6 text-white"><h1 className="text-xl">The Field Notes inbox is unavailable</h1><p>This is a loading error, not an empty inbox. Retry or check the database configuration.</p><button onClick={reset} className="rounded-xl bg-blue-700 p-3">Retry</button><a href="/owner" className="block underline">Back to Owner</a></main>;
}
