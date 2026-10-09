"use client";

export default function CustomerAccountError({ reset }: { reset: () => void }) {
  return <section className="mx-auto max-w-lg rounded-2xl bg-white p-6 text-[#0B1220]" role="alert">
    <h1 className="text-xl font-bold">We couldn’t load your account</h1>
    <p className="my-4">Please try again. If this continues, contact Chill Pros at chillprostx@gmail.com.</p>
    <button onClick={reset} className="rounded-xl bg-[#1F6FEB] px-4 py-3 font-semibold text-white">Try again</button>
  </section>;
}
