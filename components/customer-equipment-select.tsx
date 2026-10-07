"use client";

import { useRef } from "react";

import { useFormCustomer } from "@/components/use-form-customer";

type Unit = { id: string; customerId: string; label: string };

// Equipment picker that only lists the chosen customer's units, so a quote or
// invoice can't be linked to another customer's equipment by mistake.
export function CustomerEquipmentSelect({ units, initialCustomerId, className }: { units: Unit[]; initialCustomerId: string; className: string }) {
  const ref = useRef<HTMLSelectElement>(null);
  const customerId = useFormCustomer(ref, initialCustomerId);
  const mine = customerId ? units.filter((unit) => unit.customerId === customerId) : [];
  const placeholder = !customerId ? "Pick the customer first, or add new equipment below" : mine.length ? "Choose this customer's equipment (optional)" : "No saved equipment for this customer — add it below";
  return (
    <select ref={ref} name="equipmentId" key={customerId} defaultValue="" className={className}>
      <option value="">{placeholder}</option>
      {mine.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
    </select>
  );
}
