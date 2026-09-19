import "server-only";
import { createServiceRoleClient } from "@/lib/neon/data-api/service-client";
import { JOB_ACTIVE_STATUSES } from "./types";
import type { DispatchJob } from "./operations-queries";

const FIELD_VISIBLE = ["scheduled","in_progress","dispatched","en_route","arrived","diagnosing","awaiting_approval","approved","parts_required","return_visit_needed","repairing","work_complete","ready_to_invoice"] as const;
const normalize = (value:string) => String(value||"").trim().toLowerCase().replace(/\s+/g," ");

export async function getAssignedFieldJobsForTechnician(profile: { id:string; email:string; fullName?:string }, limit=250): Promise<DispatchJob[]> {
  const supabase=createServiceRoleClient();
  const email=normalize(profile.email);
  const fullName=normalize(profile.fullName||"");
  const candidateIds=new Set<string>([profile.id]);

  const {data:profiles}=await supabase
    .from("chillbros_profiles")
    .select("id,email,full_name,role,status")
    .in("role",["technician","manager"]);

  for(const row of profiles??[]){
    const rowEmail=normalize(row.email??"");
    const rowName=normalize(row.full_name??"");
    if((email && rowEmail===email) || (fullName && rowName===fullName)) candidateIds.add(row.id);
  }

  const ids=Array.from(candidateIds);
  const {data,error}=await supabase.from("chillbros_jobs")
    .select("id,customer_id,assigned_tech_id,status,location,scope,work_performed,scheduled_window,created_at,customer:chillbros_customers(name),tech:chillbros_profiles(full_name)")
    .in("assigned_tech_id",ids)
    .in("status",FIELD_VISIBLE as unknown as string[])
    .is("archived_at",null)
    .order("created_at",{ascending:false})
    .limit(limit);
  if(error||!data){
    console.error(`[technician-queue] lookup failed profile=${profile.id} aliases=${ids.length}`, error);
    return [];
  }
  console.info(`[technician-queue] profile=${profile.id} aliases=${ids.length} jobs=${data.length}`);
  return data.filter((row:any)=>JOB_ACTIVE_STATUSES.includes(row.status)).map((row:any)=>{
    const customer=Array.isArray(row.customer)?row.customer[0]:row.customer;
    const tech=Array.isArray(row.tech)?row.tech[0]:row.tech;
    return {id:row.id,customerId:row.customer_id,customerName:customer?.name??"Unknown customer",assignedTechId:row.assigned_tech_id,assignedTechName:tech?.full_name??null,status:row.status,location:row.location,scope:row.scope,workPerformed:row.work_performed,scheduledWindow:row.scheduled_window,createdAt:row.created_at,workflowStage:row.status};
  });
}