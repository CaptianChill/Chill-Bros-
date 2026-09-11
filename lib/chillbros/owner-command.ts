import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { JOB_ACTIVE_STATUSES } from "./types";

export async function getOwnerCommandMetrics() {
  const supabase = createServiceRoleClient();
  const [{data:jobs},{data:invoices},{data:techs}] = await Promise.all([
    supabase.from("chillbros_jobs").select("id,status,assigned_tech_id,scope,scheduled_window,created_at,customer:chillbros_customers(name),tech:chillbros_profiles(full_name)").in("status",JOB_ACTIVE_STATUSES).order("created_at",{ascending:false}).limit(300),
    supabase.from("chillbros_invoices").select("id,status,payment_status,invoice_number,updated_at,line:chillbros_invoice_line_items(amount),customer:chillbros_customers(name)").is("revoked_at",null).neq("status","void").order("updated_at",{ascending:false}).limit(300),
    supabase.from("chillbros_profiles").select("id,full_name,role,status").eq("role","technician").eq("status","active")
  ]);
  const invoiceRows=(invoices??[]) as any[]; const jobRows=(jobs??[]) as any[];
  const total=(r:any)=>((r.line??[]) as any[]).reduce((s:number,x:any)=>s+Number(x.amount??0),0);
  const unpaid=invoiceRows.filter(r=>r.payment_status!=="paid");
  const awaiting=invoiceRows.filter(r=>r.status==="awaiting_approval");
  const activeTechIds=new Set(jobRows.map(r=>r.assigned_tech_id).filter(Boolean));
  const attention=jobRows.filter(r=>!r.assigned_tech_id||["parts_required","return_visit_needed","awaiting_approval","ready_to_invoice"].includes(r.status)).slice(0,12).map(r=>({id:r.id,status:r.status,customer:(Array.isArray(r.customer)?r.customer[0]:r.customer)?.name??"Unknown",tech:(Array.isArray(r.tech)?r.tech[0]:r.tech)?.full_name??null,scope:r.scope}));
  return { openJobs:jobRows.length, unassigned:jobRows.filter(r=>!r.assigned_tech_id).length, emergencies:jobRows.filter(r=>/emergency|down|no cool|not cooling|freezer/i.test(String(r.scope??""))).length, activeTechs:activeTechIds.size, availableTechs:Math.max(0,(techs??[]).length-activeTechIds.size), unpaidAmount:unpaid.reduce((s,r)=>s+total(r),0), awaitingApprovalAmount:awaiting.reduce((s,r)=>s+total(r),0), awaitingApprovalCount:awaiting.length, readyToInvoice:jobRows.filter(r=>r.status==="ready_to_invoice").length, returnVisits:jobRows.filter(r=>r.status==="return_visit_needed").length, partsDelays:jobRows.filter(r=>r.status==="parts_required").length, attention };
}