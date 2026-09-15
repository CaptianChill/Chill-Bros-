import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { JOB_ACTIVE_STATUSES, type JobStatus } from "./types";

export type OpenWorkOrderRow = {
  id:string; jobNumber:string|null; customerName:string; location:string|null; scope:string|null;
  status:JobStatus; assignedTechId:string|null; assignedTechName:string|null; scheduledWindow:string|null;
  createdAt:string; invoiceId:string|null; invoiceNumber:string|null; invoiceStatus:string|null; paymentStatus:string|null;
};

export async function getOpenWorkOrders(): Promise<OpenWorkOrderRow[]> {
  const s=createServiceRoleClient();
  const {data,error}=await s.from("chillbros_jobs")
    .select("id,job_number,status,assigned_tech_id,location,scope,scheduled_window,created_at,customer:chillbros_customers(name),tech:chillbros_profiles(full_name),invoice:chillbros_invoices(id,invoice_number,status,payment_status,updated_at)")
    .is("archived_at",null).in("status",JOB_ACTIVE_STATUSES).order("created_at",{ascending:false}).limit(500);
  if (error) {
    console.error("[open-work-orders] Neon query failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error("Could not load open work orders.");
  }
  if (!data) return [];
  return data.map((r:any)=>{const c=Array.isArray(r.customer)?r.customer[0]:r.customer; const t=Array.isArray(r.tech)?r.tech[0]:r.tech; const invoices=(Array.isArray(r.invoice)?r.invoice:[]).filter((x:any)=>x?.status!=="void").sort((a:any,b:any)=>String(b.updated_at??"").localeCompare(String(a.updated_at??""))); const i=invoices[0]??null; return {id:r.id,jobNumber:r.job_number??null,customerName:c?.name??"Unknown customer",location:r.location,scope:r.scope,status:r.status,assignedTechId:r.assigned_tech_id,assignedTechName:t?.full_name??null,scheduledWindow:r.scheduled_window,createdAt:r.created_at,invoiceId:i?.id??null,invoiceNumber:i?.invoice_number??null,invoiceStatus:i?.status??null,paymentStatus:i?.payment_status??null};});
}
