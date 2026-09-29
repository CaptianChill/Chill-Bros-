import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
export const dynamic="force-dynamic";
function sameOrigin(r:NextRequest){const o=r.headers.get("origin");return !o||o===r.nextUrl.origin;}
export async function POST(request:NextRequest){
 if(!sameOrigin(request))return NextResponse.json({error:"Invalid origin."},{status:403});
 const profile=await getCurrentStaffProfile(); if(!profile||!["technician","manager"].includes(profile.role))return NextResponse.json({error:"Not authorized."},{status:403});
 const body=await request.json().catch(()=>null) as any; const jobId=String(body?.jobId??""); const lat=Number(body?.lat),lon=Number(body?.lon),accuracy=Number(body?.accuracy);
 if(!/^[0-9a-f-]{36}$/i.test(jobId)||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return NextResponse.json({error:"Invalid location."},{status:400});
 const db=createServiceRoleClient(); const {data:job}=await db.from("chillbros_jobs").select("id,assigned_tech_id,status").eq("id",jobId).maybeSingle();
 if(!job|| (profile.role==="technician"&&job.assigned_tech_id!==profile.id))return NextResponse.json({error:"Not assigned to this call."},{status:403});
 if(!["en_route","arrived","in_progress","diagnosing","repairing"].includes(job.status))return NextResponse.json({ok:true,ignored:true});
 const payload=JSON.stringify({lat:Number(lat.toFixed(6)),lon:Number(lon.toFixed(6)),accuracy:Number.isFinite(accuracy)?Math.round(accuracy):null,at:new Date().toISOString(),techId:profile.id});
 const {error}=await db.from("chillbros_workflow_events").insert({job_id:jobId,actor_id:profile.id,stage:"tech_location",message:payload});
 if(error)return NextResponse.json({error:"Location update failed."},{status:500});
 return NextResponse.json({ok:true});
}
