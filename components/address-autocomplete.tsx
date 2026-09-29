"use client";

import { useEffect, useState } from "react";

type Suggestion = { label: string; lat: number; lon: number };

export function AddressAutocomplete({ value, onChange, placeholder, className, name }: { value: string; onChange: (value:string)=>void; placeholder?:string; className?:string; name?:string }) {
  const [items,setItems]=useState<Suggestion[]>([]);
  const [open,setOpen]=useState(false);
  useEffect(()=>{ const q=value.trim(); if(q.length<4){setItems([]);return;} const timer=window.setTimeout(async()=>{try{const res=await fetch(`/api/address-suggest?q=${encodeURIComponent(q)}`); if(!res.ok)return; const body=await res.json(); setItems(Array.isArray(body.suggestions)?body.suggestions:[]); setOpen(true);}catch{}},250); return()=>window.clearTimeout(timer);},[value]);
  return <div className="relative">
    <input name={name} value={value} onChange={(e)=>onChange(e.target.value)} onFocus={()=>setOpen(true)} autoComplete="street-address" placeholder={placeholder} className={className} />
    {open&&items.length?<div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-[#C7D3E2] bg-white shadow-xl">{items.map((item)=><button key={item.label} type="button" onMouseDown={(e)=>e.preventDefault()} onClick={()=>{onChange(item.label);setOpen(false);}} className="block w-full border-b border-[#EDF1F6] px-3 py-2.5 text-left text-sm font-medium text-[#0A1A33] last:border-0 hover:bg-[#EAF2FC]">{item.label}</button>)}</div>:null}
  </div>;
}
