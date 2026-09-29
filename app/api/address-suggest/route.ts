import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
  const profile=await getCurrentStaffProfile(); if(!profile)return NextResponse.json({error:"Not signed in."},{status:401});
  const q=(request.nextUrl.searchParams.get("q")??"").trim().slice(0,180); if(q.length<4)return NextResponse.json({suggestions:[]});
  try{
    const url=new URL("https://photon.komoot.io/api/"); url.searchParams.set("q",q); url.searchParams.set("limit","6"); url.searchParams.set("lang","en"); url.searchParams.set("lat","29.4241"); url.searchParams.set("lon","-98.4936");
    const res=await fetch(url,{headers:{"User-Agent":"ChillPros-FieldOps/1.0"},signal:AbortSignal.timeout(5000),next:{revalidate:0}});
    if(!res.ok)throw new Error(String(res.status)); const data=await res.json();
    const suggestions=(data.features??[]).map((f:any)=>{const p=f.properties??{};const label=[p.housenumber,p.street,p.city||p.locality,p.state,p.postcode].filter(Boolean).join(" ");return {label,lon:Number(f.geometry?.coordinates?.[0]),lat:Number(f.geometry?.coordinates?.[1])};}).filter((x:any)=>x.label&&Number.isFinite(x.lat)&&Number.isFinite(x.lon)).slice(0,6);
    return NextResponse.json({suggestions},{headers:{"Cache-Control":"private, max-age=60"}});
  }catch{return NextResponse.json({suggestions:[]});}
}
