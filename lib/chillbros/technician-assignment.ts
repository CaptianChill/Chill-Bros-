import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { JOB_ACTIVE_STATUSES } from "./types";
import type { DispatchJob } from "./operations-queries";

const FIELD_VISIBLE = ["scheduled","in_progress","dispatched","en_route","arrived","diagnosing","awaiting_approval","approved","parts_required","return_visit_needed","repairing","work_complete","ready_to_invoice"] as const;

export async function getAssignedFieldJobsForTechnician(profile: { id:string; email:string; fullName?:string }, limit=250): Promise<DispatchJob[]> {
  const supabase=createServiceRoleClient();
  const email=String(profile.email||"").trim().toLowerCase();
  const fullName=String(profile.fullName||"").trim();
  const candidateIds=new Set<string>([profile.id]);

  if(email){
    const {data:matches}=await supabase.from("chillbros_profiles").select("id,email,full_name,role,status").ilike("email",email).eq("status","active").in("role",["technician","manager"]);
    for(const row of matches??[]) candidateIds.add(row.id);
  }
  if(fullName){
    const {data:nameMatches}=await supabase.from("chillbros_profiles").select("id,email,full_name,role,status").ilike("full_name",fullName).eq("status","active").in("role",["technician","manager"]);
    for(const row of nameMatches??[]) candidateIds.add(row.id);
  }

  const ids=Array.from(candidateIds);
  const {data,error}=await supabase.from("chillbros_jobs").select("id,customer_id,assigned_tech_id,status,location,scope,work_performed,scheduled_window,created_at,customer:chillbros_customers(name),tech:chillbros_profiles(full_name)").in("assigned_tech_id",ids).in("status",FIELD_VISIBLE as unknown as string[]).is("archived_at",null).order("created_at",{ascending:false}).limit(limit);
  if(error||!data)return [];
  return data.filter((row:any)=>JOB_ACTIVE_STATUSES.includes(row.status)).map((row:any)=>{const customer=Array.isArray(row.customer)?row.customer[0]:row.customer;const tech=Array.isArray(row.tech)?row.tech[0]:row.tech;return {id:row.id,customerId:row.customer_id,customerName:customer?.name??"Unknown customer",assignedTechId:row.assigned_tech_id,assignedTechName:tech?.full_name??null,status:row.status,location:row.location,scope:row.scope,workPerformed:row.work_performed,scheduledWindow:row.scheduled_window,createdAt:row.created_at,workflowStage:row.status};});
}
