"use client";

import { useEffect, useState, type RefObject } from "react";

// Follows the customer chosen in the same form's "customerId" picker, so
// equipment and parts lists can narrow to that customer as soon as it changes
// (also when a saved draft is restored, since restore fires change events).
export function useFormCustomer(ref: RefObject<HTMLElement | null>, initial = "") {
  const [customerId, setCustomerId] = useState(initial);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const read = () => {
      const control = form.elements.namedItem("customerId");
      setCustomerId(control instanceof HTMLSelectElement || control instanceof HTMLInputElement ? control.value : "");
    };
    const onChange = (event: Event) => { if ((event.target as HTMLElement | null)?.getAttribute("name") === "customerId") read(); };
    form.addEventListener("change", onChange);
    form.addEventListener("input", onChange);
    return () => { form.removeEventListener("change", onChange); form.removeEventListener("input", onChange); };
  }, [ref]);
  return customerId;
}
