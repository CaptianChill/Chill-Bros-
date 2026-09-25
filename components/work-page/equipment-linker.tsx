"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {findOrCreateAndAttachEquipmentAction} from "@/lib/chillbros/equipment";

export function EquipmentLinker({jobId}:{jobId:string}){
 const router=useRouter(); const [pending,startTransition]=useTransition(); const [error,setError]=useState<string|null>(null);
 const [v,setV]=useState({equipmentType:"Refrigeration",manufacturer:"",model:"",serialNumber:"",refrigerant:""});
 const save=()=>startTransition(async()=>{setError(null);const r=await findOrCreateAndAttachEquipmentAction({jobId,...v});if(!r.ok){setError(r.error);return}router.refresh()});
 const field="min-h-11 w-full rounded-xl border border-[#C7D3E2] bg-[#F8FAFD] px-3 text-[#0A1A33]";
 return <details className="cb-work-card p-3.5"><summary className="flex min-h-11 cursor-pointer list-none items-center font-semibold text-[#0A1A33]">Equipment · select or add unit</summary>
  <div className="mt-3 grid gap-2 sm:grid-cols-2">
   <input className={field} value={v.equipmentType} onChange={e=>setV({...v,equipmentType:e.target.value})} placeholder="Equipment type"/>
   <input className={field} value={v.manufacturer} onChange={e=>setV({...v,manufacturer:e.target.value})} placeholder="Brand / manufacturer"/>
   <input className={field} value={v.model} onChange={e=>setV({...v,model:e.target.value})} placeholder="Model"/>
   <input className={field} value={v.serialNumber} onChange={e=>setV({...v,serialNumber:e.target.value})} placeholder="Serial number"/>
   <input className={field} value={v.refrigerant} onChange={e=>setV({...v,refrigerant:e.target.value})} placeholder="Refrigerant (optional)"/>
   <button type="button" disabled={pending||!v.manufacturer||!v.model||!v.serialNumber} onClick={save} className="min-h-11 rounded-xl bg-[#1557B0] px-4 font-semibold text-white disabled:opacity-50">{pending?"Saving…":"Save & attach unit"}</button>
  </div>{error?<p className="mt-2 text-sm font-semibold text-[#0B5CD5]">{error}</p>:null}
  <p className="mt-2 text-xs text-[#5B6B82]">Existing serials are reused for this customer. New units receive a permanent Chill Pros asset record automatically.</p>
 </details>
}