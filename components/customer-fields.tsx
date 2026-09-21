"use client";

import { useState } from "react";

type CustomerOption = { id: string; name: string; phone: string | null; email: string | null; address: string | null };

function fieldsFor(customers: CustomerOption[], id: string) {
  const match = customers.find((customer) => customer.id === id);
  return { name: match?.name ?? "", phone: match?.phone ?? "", email: match?.email ?? "", address: match?.address ?? "" };
}

export function CustomerFields({ customers, initialCustomerId, input, label }: { customers: CustomerOption[]; initialCustomerId: string; input: string; label: string }) {
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [fields, setFields] = useState(() => fieldsFor(customers, initialCustomerId));

  function selectCustomer(id: string) {
    setCustomerId(id);
    setFields(fieldsFor(customers, id));
  }

  return (
    <div className="mt-4 space-y-3">
      <label className={label}>Customer database
        <select name="customerId" value={customerId} onChange={(event) => selectCustomer(event.target.value)} className={`${input} mt-1`}>
          <option value="">+ New customer</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>Customer / business name<input name="customerName" value={fields.name} onChange={(event) => setFields({ ...fields, name: event.target.value })} placeholder="Required only for a new customer" className={`${input} mt-1`} /></label>
        <label className={label}>Phone<input name="customerPhone" inputMode="tel" value={fields.phone} onChange={(event) => setFields({ ...fields, phone: event.target.value })} placeholder="Phone" className={`${input} mt-1`} /></label>
        <label className={label}>Email<input name="customerEmail" type="email" value={fields.email} onChange={(event) => setFields({ ...fields, email: event.target.value })} placeholder="Email" className={`${input} mt-1`} /></label>
        <label className={label}>Address<input name="customerAddress" value={fields.address} onChange={(event) => setFields({ ...fields, address: event.target.value })} placeholder="Billing / service address" className={`${input} mt-1`} /></label>
      </div>
      {customerId ? <p className="text-xs text-zinc-500">Auto-filled from the customer database. Edit here if it needs updating for this document only — it won&apos;t change the saved customer record.</p> : null}
    </div>
  );
}
