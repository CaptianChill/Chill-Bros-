"use client";

import { useFormStatus } from "react-dom";

// Disables itself while its form's server action runs, so a tap can't submit twice.
export function SubmitButton({ children, pendingText, className }: { children: React.ReactNode; pendingText: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}
