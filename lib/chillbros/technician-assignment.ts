import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { JOB_ACTIVE_STATUSES } from "./types";
import type { DispatchJob } from "./operations-queries";

const FIELD_VISIBLE = ["scheduled","in_progress","dispatched","en_route","arrived","diagnosing","awaiting_approval","approved","parts_required","return_visit_needed","repairing","work_complete","ready_to_invoice"] as const;
export async function getAssignedFieldJobsForTechnician(profile: { id:string }, limit=250): Promise<DispatchJob[]> {
  const supabase=createServiceRoleClient();
  const {data,error}=await supabase.from("chillbros_jobs")
    .select("id,customer_id,assigned_tech_id,status,location,scope,work_performed,scheduled_window,created_at,customer:chillbros_customers(name),tech:chillbros_profiles!chillbros_jobs_assigned_tech_id_fkey(full_name)")
    .eq("assigned_tech_id",profile.id)
    .in("status",FIELD_VISIBLE as unknown as string[])
    .is("archived_at",null)
    .order("created_at",{ascending:false})
    .limit(limit);
  if(error||!data){
    console.error(`[technician-queue] lookup failed profile=${profile.id}`, error);
    return [];
  }
  console.info(`[technician-queue] profile=${profile.id} jobs=${data.length}`);
  return data.filter((row:any)=>JOB_ACTIVE_STATUSES.includes(row.status)).map((row:any)=>{
    const customer=Array.isArray(row.customer)?row.customer[0]:row.customer;
    const tech=Array.isArray(row.tech)?row.tech[0]:row.tech;
    return {id:row.id,customerId:row.customer_id,customerName:customer?.name??"Unknown customer",assignedTechId:row.assigned_tech_id,assignedTechName:tech?.full_name??null,status:row.status,location:row.location,scope:row.scope,workPerformed:row.work_performed,scheduledWindow:row.scheduled_window,createdAt:row.created_at,workflowStage:row.status};
  });
}