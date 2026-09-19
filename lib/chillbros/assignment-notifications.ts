import "server-only";
import { sendCompanyEmail } from "./approval-notifications";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

function appBaseUrl(){if(process.env.VERCEL_ENV==="preview"&&process.env.VERCEL_URL)return `https://${process.env.VERCEL_URL}`;const x=String(process.env.NEXT_PUBLIC_APP_URL||process.env.VERCEL_PROJECT_PRODUCTION_URL||"https://chill-bros.vercel.app").replace(/\/$/,"");return x.startsWith("http")?x:`https://${x}`;}

async function resolveCanonicalTechnicianEmail(supabase:ReturnType<typeof createServiceRoleClient>, assignedId:string, fullName:string, profileEmail:string){
  const candidates=new Map<string,{id:string;email:string;full_name:string}>();
  const {data:profiles}=await supabase.from("chillbros_profiles").select("id,email,full_name,role,status").in("role",["technician","manager"]);
  for(const row of profiles??[]){
    const sameId=row.id===assignedId;
    const sameEmail=profileEmail&&String(row.email??"").trim().toLowerCase()===profileEmail.toLowerCase();
    const sameName=fullName&&String(row.full_name??"").trim().toLowerCase()===fullName.toLowerCase();
    if(sameId||sameEmail||sameName)candidates.set(row.id,{id:row.id,email:String(row.email??"").trim(),full_name:String(row.full_name??"").trim()});
  }
  try{
    let page=1;
    while(page<=10){
      const {data,error}=await supabase.auth.admin.listUsers({page,perPage:1000});
      if(error)break;
      for(const user of data.users??[]){
        const candidate=candidates.get(user.id);
        if(candidate){const authEmail=String(user.email??"").trim();if(authEmail)return {email:authEmail,profileId:user.id,source:"auth-backed-profile" as const};}
      }
      if((data.users??[]).length<1000)break;
      page+=1;
    }
  }catch(error){console.error("[assignment-email] auth lookup failed",error);}
  if(profileEmail)return {email:profileEmail,profileId:assignedId,source:"assigned-profile" as const};
  const fallback=Array.from(candidates.values()).find(x=>x.email);
  return fallback?{email:fallback.email,profileId:fallback.id,source:"matching-profile" as const}:null;
}

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
    supabase.from("chillbros_profiles").select("id,full_name,email,status").eq("id",job.assigned_tech_id).maybeSingle(),
    supabase.from("chillbros_customers").select("id,name").eq("id",job.customer_id).maybeSingle(),
  ]);

  if(techError) console.error(`[assignment-email] job=${jobId} tech_lookup_failed`,techError);
  if(customerError) console.error(`[assignment-email] job=${jobId} customer_lookup_failed`,customerError);

  const techName=String(tech?.full_name??"Technician");
  const profileEmail=String(tech?.email??"").trim();
  const resolved=await resolveCanonicalTechnicianEmail(supabase,job.assigned_tech_id,techName,profileEmail);
  if(!resolved){
    console.error(`[assignment-email] job=${jobId} technician_email_missing assigned=${job.assigned_tech_id}`);
    return {sent:false as const,status:"technician_email_missing",recipient:null};
  }

  const email=resolved.email;
  const customerName=String(customer?.name??"Customer");
  const subject=kind==="assigned"?`New Chill Bros service call: ${customerName}`:`Chill Bros schedule updated: ${customerName}`;
  const text=[`Hi ${techName},`,"",kind==="assigned"?"A new service call has been assigned to you.":"One of your assigned service calls has been updated.",`Customer: ${customerName}`,`Schedule: ${job.scheduled_window||"Not set"}`,`Location: ${job.location||"Not set"}`,job.scope?`Scope: ${job.scope}`:"","",`Open call: ${appBaseUrl()}/technician?job=${encodeURIComponent(job.id)}`].filter(Boolean).join("\n");
  let status="failed";
  try{const result=await sendCompanyEmail(email,subject,text);status=result.sent?result.status:result.error;}catch(e){status=`failed: ${e instanceof Error?e.message.slice(0,160):"unknown"}`;}
  console.info(`[assignment-email] job=${jobId} assigned=${job.assigned_tech_id} recipient=${email} source=${resolved.source} status=${status}`);
  try{const {error}=await supabase.from("chillbros_email_log").insert({subject,recipients:email,status:status==="sent"?"sent":"failed"});if(error)console.error("[assignment-email] log insert failed",error);}catch(error){console.error("[assignment-email] log insert failed",error);}
  return {sent:status==="sent",status,recipient:email,profileId:resolved.profileId};
}

export async function verifyTechnicianAssignment(jobId:string,technicianId:string){
  const supabase=createServiceRoleClient();
  const {data,error}=await supabase.from("chillbros_jobs").select("id,assigned_tech_id,status,scheduled_window").eq("id",jobId).maybeSingle();
  if(error||!data)return {ok:false as const,error:error?.message??"Job could not be reread."};
  if(data.assigned_tech_id!==technicianId)return {ok:false as const,error:"Technician assignment did not persist."};
  await supabase.from("chillbros_workflow_events").insert({job_id:jobId,stage:"technician_assigned",message:`Technician assignment verified for profile ${technicianId}.`});
  return {ok:true as const};
}
