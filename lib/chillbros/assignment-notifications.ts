import "server-only";
import { sendCompanyEmail } from "./approval-notifications";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

function appBaseUrl(){const x=String(process.env.NEXT_PUBLIC_APP_URL||process.env.VERCEL_PROJECT_PRODUCTION_URL||"https://chill-bros.vercel.app").replace(/\/$/,"");return x.startsWith("http")?x:`https://${x}`;}

export async function sendTechnicianAssignmentEmail(jobId:string, kind:"assigned"|"updated"="assigned"){
  const supabase=createServiceRoleClient();
  const {data:job,error}=await supabase.from("chillbros_jobs").select("id,location,scope,scheduled_window,assigned_tech_id,customer:chillbros_customers(name),tech:chillbros_profiles(full_name,email)").eq("id",jobId).maybeSingle();
  if(error||!job?.assigned_tech_id)return {sent:false as const,status:"job_or_assignment_missing"};
  const tech=Array.isArray(job.tech)?job.tech[0]:job.tech; const customer=Array.isArray(job.customer)?job.customer[0]:job.customer;
  const email=String(tech?.email??"").trim(); if(!email)return {sent:false as const,status:"technician_email_missing"};
  const techName=String(tech?.full_name??"Technician"); const customerName=String(customer?.name??"Customer");
  const subject=kind==="assigned"?`New Chill Bros service call: ${customerName}`:`Chill Bros schedule updated: ${customerName}`;
  const text=[`Hi ${techName},`,"",kind==="assigned"?"A new service call has been assigned to you.":"One of your assigned service calls has been updated.",`Customer: ${customerName}`,`Schedule: ${job.scheduled_window||"Not set"}`,`Location: ${job.location||"Not set"}`,job.scope?`Scope: ${job.scope}`:"","",`Open call: ${appBaseUrl()}/technician?job=${encodeURIComponent(job.id)}`].filter(Boolean).join("\n");
  let status="failed";
  try{const result=await sendCompanyEmail(email,subject,text);status=result.status;}catch(e){status=`failed: ${e instanceof Error?e.message.slice(0,160):"unknown"}`;}
  try{await supabase.from("chillbros_email_log").insert({subject,recipients:email,status});}catch{}
  return {sent:status==="sent",status};
}

export async function verifyTechnicianAssignment(jobId:string,technicianId:string){
  const supabase=createServiceRoleClient(); const {data,error}=await supabase.from("chillbros_jobs").select("id,assigned_tech_id,status,scheduled_window").eq("id",jobId).maybeSingle();
  if(error||!data)return {ok:false as const,error:error?.message??"Job could not be reread."};
  if(data.assigned_tech_id!==technicianId)return {ok:false as const,error:"Technician assignment did not persist."};
  await supabase.from("chillbros_workflow_events").insert({job_id:jobId,stage:"technician_assigned",message:`Technician assignment verified for profile ${technicianId}.`});
  return {ok:true as const};
}
