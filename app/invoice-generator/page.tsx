"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const DOCS_KEY = "chillpros_generator_docs_v1";
const CUSTOMERS_KEY = "chillpros_generator_customers_v1";
const SETTINGS_KEY = "chillpros_generator_settings_v1";

function safeRead(key: string) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function InvoiceGeneratorPage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    const savedDocs = safeRead(DOCS_KEY);
    const savedCustomers = safeRead(CUSTOMERS_KEY);
    setDocs(Array.isArray(savedDocs) ? savedDocs : []);
    setCustomers(Array.isArray(savedCustomers) ? savedCustomers : []);
    setSettings(safeRead(SETTINGS_KEY));
  }, []);

  const latest = useMemo(() => {
    return [...docs].sort((a, b) => String(b?.updatedAt ?? "").localeCompare(String(a?.updatedAt ?? "")))[0] ?? null;
  }, [docs]);

  function exportBackup() {
    const payload = {
      exportedAt: new Date().toISOString(),
      documents: docs,
      customers,
      settings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `chill-pros-invoice-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <section className="rounded-2xl border border-[#2d7dff]/25 bg-black/35 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ffafa]/70">Invoice recovery & live billing</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Your saved invoice data is still here</h1>
        <p className="mt-3 text-sm leading-6 text-[#d9fbff]/80">
          The standalone generator stored its work in this browser. This page reads that same storage so your documents, customers, payment settings, and the invoice you just entered remain recoverable while the live payable invoice system is used for new billing.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#2d7dff]/20 bg-black/30 p-4"><p className="text-xs text-[#8ffafa]/70">Saved documents</p><p className="mt-1 text-2xl font-semibold text-white">{docs.length}</p></div>
          <div className="rounded-xl border border-[#2d7dff]/20 bg-black/30 p-4"><p className="text-xs text-[#8ffafa]/70">Saved customers</p><p className="mt-1 text-2xl font-semibold text-white">{customers.length}</p></div>
          <div className="rounded-xl border border-[#2d7dff]/20 bg-black/30 p-4"><p className="text-xs text-[#8ffafa]/70">Payment settings</p><p className="mt-1 text-base font-semibold text-white">{settings ? "Preserved" : "Not found"}</p></div>
        </div>

        {latest ? (
          <div className="mt-4 rounded-xl border border-[#8ffafa]/25 bg-[#2d7dff]/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8ffafa]/75">Most recent saved document</p>
            <p className="mt-2 text-base font-semibold text-white">{latest.number || "Saved invoice"} · {latest.customer?.name || "Customer"}</p>
            <p className="mt-1 text-sm text-[#d9fbff]/75">Total: ${Number(latest.total || 0).toFixed(2)}</p>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <a href="/invoice-generator/index.html" className="inline-flex min-h-11 items-center rounded-xl border border-[#8ffafa]/60 bg-[#2d7dff]/20 px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2d7dff]/30">Open Saved Generator</a>
          <Link href="/invoices/new" className="inline-flex min-h-11 items-center rounded-xl border border-[#8ffafa]/60 bg-[#2d7dff]/20 px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2d7dff]/30">Create Payable Invoice</Link>
          <button type="button" onClick={exportBackup} className="inline-flex min-h-11 items-center rounded-xl border border-[#2d7dff]/25 bg-black/35 px-4 py-2.5 text-sm font-semibold text-[#d9fbff] hover:border-[#8ffafa]/35">Backup All Saved Data</button>
          <Link href="/payroll" className="inline-flex min-h-11 items-center rounded-xl border border-[#2d7dff]/25 bg-black/35 px-4 py-2.5 text-sm font-semibold text-[#d9fbff] hover:border-[#8ffafa]/35">Payroll & Paystubs</Link>
        </div>
      </section>
    </main>
  );
}
