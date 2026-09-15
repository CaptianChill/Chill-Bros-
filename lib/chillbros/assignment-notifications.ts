import "server-only";
import { sendCompanyEmail } from "./approval-notifications";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

function appBaseUrl(){const x=String(process.env.NEXT_PUBLIC_APP_URL||process.env.VERCEL_PROJECT_PRODUCTION_URL||"https://chill-bros.vercel.app").replace(/\/$/,"");return x.startsWith("http")?x:`https://${x}`;}

export async function sendTechnicianAssignmentEmail(jobId:string, kind:"assigned"|"updated"="assigned"){
  const supabase=createServiceRoleClient();

  const {data:job,error:jobError}=await supabase
    .from("chillbros_jobs")
    .select("id,customer_id,location,scope,scheduled_window,assigned_tech_id")
    .eq("id",jobId)
    .maybeSingle();

  if(jobError){
    console.error(`[assignment-email] job=${jobId} job_lookup_failed`,jobError);
    return {sent:false as const,status:`job_lookup_failed:${jobError.message}`,recipient:null};
  }
  if(!job){
    console.error(`[assignment-email] job=${jobId} job_missing`);
    return {sent:false as const,status:"job_missing",recipient:null};
  }
  if(!job.assigned_tech_id){
    console.error(`[assignment-email] job=${jobId} assignment_missing`);
    return {sent:false as const,status:"assignment_missing",recipient:null};
  }

  const [{data:tech,error:techError},{data:customer,error:customerError}]=await Promise.all([
    supabase.from("chillbros_profiles").select("id,auth_user_id,full_name,email,status").eq("id",job.assigned_tech_id).maybeSingle(),
    supabase.from("chillbros_customers").select("id,name").eq("id",job.customer_id).maybeSingle(),
  ]);

  if(techError) console.error(`[assignment-email] job=${jobId} tech_lookup_failed`,techError);
  if(customerError) console.error(`[assignment-email] job=${jobId} customer_lookup_failed`,customerError);

  if(!tech||tech.status!=="active"){
    console.error(`[assignment-email] job=${jobId} technician_profile_inactive assigned=${job.assigned_tech_id}`);
    return {sent:false as const,status:"technician_profile_inactive",recipient:null};
  }
  if(!tech.auth_user_id){
    console.error(`[assignment-email] job=${jobId} technician_auth_link_missing assigned=${job.assigned_tech_id}`);
    return {sent:false as const,status:"technician_auth_link_missing",recipient:null};
  }
  const techName=String(tech.full_name||"Technician");
  const email=String(tech.email||"").trim();
  if(!email){
    console.error(`[assignment-email] job=${jobId} technician_email_missing assigned=${job.assigned_tech_id}`);
    return {sent:false as const,status:"technician_email_missing",recipient:null};
  }
  const customerName=String(customer?.name??"Customer");
  const subject=kind==="assigned"?`New Chill Bros service call: ${customerName}`:`Chill Bros schedule updated: ${customerName}`;
  const text=[`Hi ${techName},`,"",kind==="assigned"?"A new service call has been assigned to you.":"One of your assigned service calls has been updated.",`Customer: ${customerName}`,`Schedule: ${job.scheduled_window||"Not set"}`,`Location: ${job.location||"Not set"}`,job.scope?`Scope: ${job.scope}`:"","",`Open call: ${appBaseUrl()}/technician?job=${encodeURIComponent(job.id)}`].filter(Boolean).join("\n");
  let status="failed";
  try{const result=await sendCompanyEmail(email,subject,text);status=result.status;}catch(e){status=`failed: ${e instanceof Error?e.message.slice(0,160):"unknown"}`;}
  console.info(`[assignment-email] job=${jobId} assigned=${job.assigned_tech_id} recipient=${email} source=canonical-profile status=${status}`);
  try{await supabase.from("chillbros_email_log").insert({subject,recipients:email,status});}catch{}
  return {sent:status==="sent",status,recipient:email,profileId:job.assigned_tech_id};
}

export async function verifyTechnicianAssignment(jobId:string,technicianId:string){
  const supabase=createServiceRoleClient();
  const {data,error}=await supabase.from("chillbros_jobs").select("id,assigned_tech_id,status,scheduled_window").eq("id",jobId).maybeSingle();
  if(error||!data)return {ok:false as const,error:error?.message??"Job could not be reread."};
  if(data.assigned_tech_id!==technicianId)return {ok:false as const,error:"Technician assignment did not persist."};
  await supabase.from("chillbros_workflow_events").insert({job_id:jobId,stage:"technician_assigned",message:`Technician assignment verified for profile ${technicianId}.`});
  return {ok:true as const};
}
