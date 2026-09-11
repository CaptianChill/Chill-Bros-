import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export async function getInventoryIntelligence(){
  const s=createServiceRoleClient();
  const [{data:parts},{data:usage}]=await Promise.all([
    s.from("chillbros_parts_catalog").select("id,name,part_number,default_cost,retail_price,stock,updated_at").not("part_number","like","PB-%").order("name"),
    s.from("chillbros_job_parts").select("part_id,quantity,job:chillbros_jobs(id,equipment_id,created_at)").limit(5000)
  ]);
  const used=new Map<string,{qty:number;jobs:Set<string>;equipment:Set<string>}>();
  for(const row of usage??[]){const job=Array.isArray((row as any).job)?(row as any).job[0]:(row as any).job;const x=used.get((row as any).part_id)??{qty:0,jobs:new Set<string>(),equipment:new Set<string>()};x.qty+=Number((row as any).quantity??0);if(job?.id)x.jobs.add(job.id);if(job?.equipment_id)x.equipment.add(job.equipment_id);used.set((row as any).part_id,x);}
  const rows=(parts??[]).map((p:any)=>{const u=used.get(p.id)??{qty:0,jobs:new Set<string>(),equipment:new Set<string>()};const cost=Number(p.default_cost??0),retail=Number(p.retail_price??0),margin=retail>0?((retail-cost)/retail)*100:0;const reorderPoint=Math.max(2,Math.ceil(u.qty/4));const reorderQty=Math.max(0,reorderPoint*2-Number(p.stock??0));return {id:p.id,name:p.name,partNumber:p.part_number,cost,retail,stock:Number(p.stock??0),margin,usedQty:u.qty,jobCount:u.jobs.size,equipmentCount:u.equipment.size,reorderPoint,reorderQty,lowStock:Number(p.stock??0)<=reorderPoint};});
  return {rows,summary:{catalog:rows.length,lowStock:rows.filter(r=>r.lowStock).length,inventoryValue:rows.reduce((s,r)=>s+r.cost*r.stock,0),retailValue:rows.reduce((s,r)=>s+r.retail*r.stock,0),usedUnits:rows.reduce((s,r)=>s+r.usedQty,0)}};
}