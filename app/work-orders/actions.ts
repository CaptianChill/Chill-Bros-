"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { sendTechnicianAssignmentEmail } from "@/lib/chillbros/assignment-notifications";
import { JOB_ACTIVE_STATUSES, type JobStatus } from "@/lib/chillbros/types";

function text(fd:FormData,key:string){return String(fd.get(key)??"").trim();}
function done(message:string,type:"success"|"error"="success"):never{const q=new URLSearchParams({[type]:message,t:Date.now().toString()});redirect(`/work-orders?${q.toString()}`);}
async function manager(){const p=await getCurrentStaffProfile();if(!p||p.role!=="manager")redirect("/");return p;}
function refresh(id:string){for(const path of ["/work-orders","/schedule","/dispatch","/technician","/office","/manager/command",`/jobs/${id}`]) revalidatePath(path);}

export async function updateWorkOrderAssignmentAction(fd:FormData):Promise<never>{
  const p=await manager(); const jobId=text(fd,"jobId"), techId=text(fd,"technicianId"); if(!jobId) done("Work order not found.","error");
  const s=createServiceRoleClient();
  if(techId){const {data:tech}=await s.from("chillbros_profiles").select("id,full_name").eq("id",techId).in("role",["technician","manager"]).eq("status","active").maybeSingle();if(!tech) done("Choose an active technician.","error");}
  const {data,error}=await s.from("chillbros_jobs").update({assigned_tech_id:techId||null,updated_at:new Date().toISOString()}).eq("id",jobId).is("archived_at",null).select("id,assigned_tech_id").maybeSingle();
  if(error||!data||data.assigned_tech_id!==(techId||null)) done(error?.message??"Technician assignment did not persist.","error");
  await s.from("chillbros_workflow_events").insert({job_id:jobId,actor_id:p.id,stage:"manager_assignment_override",message:techId?"Manager reassigned technician from Open Work Orders.":"Manager removed technician assignment from Open Work Orders."});
  if(techId){
    const result=await sendTechnicianAssignmentEmail(jobId,"assigned");
    await s.from("chillbros_workflow_events").insert({job_id:jobId,actor_id:p.id,stage:result.sent?"technician_assignment_email_sent":"technician_assignment_email_failed",message:`Open Work Orders assignment notification ${result.status}.`});
  }
  refresh(jobId); done(techId?"Technician assignment saved and notification processed.":"Technician assignment removed.");
}

const allowed=new Set<JobStatus>([...JOB_ACTIVE_STATUSES,"cancelled","completed"]);
export async function updateWorkOrderStatusAction(fd:FormData):Promise<never>{
  const p=await manager(); const jobId=text(fd,"jobId"), status=text(fd,"status") as JobStatus; if(!jobId||!allowed.has(status)) done("Choose a valid workflow stage.","error");
  const s=createServiceRoleClient(); const {data,error}=await s.from("chillbros_jobs").update({status,updated_at:new Date().toISOString()}).eq("id",jobId).is("archived_at",null).select("id,status").maybeSingle();
  if(error||!data||data.status!==status) done(error?.message??"Workflow change did not persist.","error");
  await s.from("chillbros_workflow_events").insert({job_id:jobId,actor_id:p.id,stage:"manager_stage_override",message:`Manager manually changed workflow stage to ${status.replace(/_/g," ")} from Open Work Orders.`});
  refresh(jobId); done(status==="cancelled"?"Work order cancelled.":"Workflow stage updated.");
}

export async function markReadyToInvoiceAction(fd:FormData):Promise<never>{
  const p=await manager(); const jobId=text(fd,"jobId"); if(!jobId) done("Work order not found.","error"); const s=createServiceRoleClient();
  const {data,error}=await s.from("chillbros_jobs").update({status:"ready_to_invoice",updated_at:new Date().toISOString()}).eq("id",jobId).is("archived_at",null).select("id,status").maybeSingle();
  if(error||!data) done(error?.message??"Could not move work order to billing.","error");
  await s.from("chillbros_workflow_events").insert({job_id:jobId,actor_id:p.id,stage:"manual_billing_handoff",message:"Manager manually moved this work order to Ready to Invoice from Open Work Orders."});
  refresh(jobId); redirect(`/invoices?job=${encodeURIComponent(jobId)}`);
}
