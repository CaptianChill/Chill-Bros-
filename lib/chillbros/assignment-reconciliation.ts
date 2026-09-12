import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { sendTechnicianAssignmentEmail } from "./assignment-notifications";

const ACTIVE_STATUSES=["new","needs_scheduling","scheduled","in_progress","dispatched","en_route","arrived","diagnosing","awaiting_approval","approved","parts_required","return_visit_needed","repairing","work_complete","ready_to_invoice","invoice_sent"];

export async function reconcileTechnicianAssignmentsAndNotifications(){
  const supabase=createServiceRoleClient();
  const {data:profiles,error}=await supabase.from("chillbros_profiles").select("id,email,full_name,role,status").in("role",["technician","manager"]).eq("status","active");
  if(error||!profiles)return {repaired:0,notified:0};

  const authByEmail=new Map<string,string>();
  try{
    let page=1;
    while(page<=10){
      const {data,error:authError}=await supabase.auth.admin.listUsers({page,perPage:1000});
      if(authError)break;
      for(const user of data.users??[]){const email=String(user.email??"").trim().toLowerCase();if(email)authByEmail.set(email,user.id);}
      if((data.users??[]).length<1000)break;
      page+=1;
    }
  }catch{}

  let repaired=0;
  for(const profile of profiles){
    const email=String(profile.email??"").trim().toLowerCase(); const canonical=email?authByEmail.get(email):null;
    if(!canonical||canonical===profile.id)continue;
    const {data:moved}=await supabase.from("chillbros_jobs").update({assigned_tech_id:canonical,updated_at:new Date().toISOString()}).eq("assigned_tech_id",profile.id).in("status",ACTIVE_STATUSES).is("archived_at",null).select("id");
    for(const job of moved??[]){
      repaired+=1;
      await supabase.from("chillbros_workflow_events").insert({job_id:job.id,stage:"technician_assignment_reconciled",message:`Assignment repaired from stale profile ${profile.id} to login-backed profile ${canonical}.`});
    }
  }

  const since=new Date(Date.now()-48*60*60*1000).toISOString();
  const {data:jobs}=await supabase.from("chillbros_jobs").select("id,assigned_tech_id,updated_at").not("assigned_tech_id","is",null).in("status",ACTIVE_STATUSES).gte("updated_at",since).is("archived_at",null).order("updated_at",{ascending:false}).limit(100);
  let notified=0;
  for(const job of jobs??[]){
    const {data:sent}=await supabase.from("chillbros_workflow_events").select("id").eq("job_id",job.id).eq("stage","technician_assignment_email_sent").limit(1);
    if(sent?.length)continue;
    const result=await sendTechnicianAssignmentEmail(job.id,"assigned");
    await supabase.from("chillbros_workflow_events").insert({job_id:job.id,stage:result.sent?"technician_assignment_email_sent":"technician_assignment_email_failed",message:`Technician assignment notification ${result.status}.`});
    if(result.sent)notified+=1;
  }
  return {repaired,notified};
}
