import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

type TechAssistEquipment = { asset_tag:string|null; equipment_type:string|null; manufacturer:string|null; model:string|null; serial_number:string|null; refrigerant:string|null; notes:string|null };
export type TechAssistJob = {
  id:string; job_number:string|null; status:string; scope:string|null; work_performed:string|null; location:string|null; scheduled_window:string|null; equipment_id:string|null;
  customer: {name:string} | {name:string}[] | null;
  equipment: TechAssistEquipment | TechAssistEquipment[] | null;
};
export type TechAssistEvent = { stage:string; message:string; created_at:string };
export type TechAssistPart = { quantity:number; part: {name:string; part_number:string} | {name:string; part_number:string}[] | null };
export type TechAssistHistoryJob = { job_number:string|null; status:string; scope:string|null; work_performed:string|null; created_at:string };

export async function getTechAssistContext(jobId:string){const s=createServiceRoleClient();const {data:job}=await s.from("chillbros_jobs").select("id,job_number,status,scope,work_performed,location,scheduled_window,equipment_id,customer:chillbros_customers(name),equipment:chillbros_equipment(asset_tag,equipment_type,manufacturer,model,serial_number,refrigerant,notes)").eq("id",jobId).maybeSingle<TechAssistJob>();if(!job)return null;const [{data:events},{data:parts},{data:history}]=await Promise.all([s.from("chillbros_workflow_events").select("stage,message,created_at").eq("job_id",jobId).order("created_at",{ascending:false}).limit(30).overrideTypes<TechAssistEvent[]>(),s.from("chillbros_job_parts").select("quantity,part:chillbros_parts_catalog(name,part_number)").eq("job_id",jobId).overrideTypes<TechAssistPart[]>(),job.equipment_id?s.from("chillbros_jobs").select("job_number,status,scope,work_performed,created_at").eq("equipment_id",job.equipment_id).neq("id",jobId).order("created_at",{ascending:false}).limit(15).overrideTypes<TechAssistHistoryJob[]>():Promise.resolve({data:[] as TechAssistHistoryJob[]})]);return {job,events:events??[],parts:parts??[],equipmentHistory:history??[]};}