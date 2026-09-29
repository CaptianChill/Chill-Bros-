"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation } from "lucide-react";

export function WorkLocationTracker({jobId,destination,active}:{jobId:string;destination:string|null;active:boolean}){
 const [status,setStatus]=useState(active?"Work location sharing is active while this call is in progress.":"Location sharing is off.");
 const last=useRef(0);
 useEffect(()=>{if(!active||!navigator.geolocation)return; let watch:number|undefined;
   setStatus("Work location is used for dispatch, ETA and routing while you are working this call.");
   watch=navigator.geolocation.watchPosition(async(pos)=>{const now=Date.now();if(now-last.current<45000)return;last.current=now;setStatus("Work location shared with owner/dispatch.");await fetch("/api/tech-location",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId,lat:pos.coords.latitude,lon:pos.coords.longitude,accuracy:pos.coords.accuracy})}).catch(()=>{});},()=>setStatus("Location permission is off. Enable it to share work location and improve routing."),{enableHighAccuracy:true,maximumAge:30000,timeout:12000});
   return()=>{if(watch!==undefined)navigator.geolocation.clearWatch(watch);};
 },[active,jobId]);
 const nav=destination?`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`:null;
 return <section className="cb-card p-3.5"><div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 text-[#1557B0]"/><div className="min-w-0 flex-1"><p className="font-bold text-[#0A1A33]">Work location & routing</p><p className="mt-1 text-sm text-[#2B3F5C]">{status}</p><p className="mt-1 text-xs text-[#5B6B82]">Tracking is for owner/dispatch visibility during active work. It stops when this call is no longer active.</p>{nav?<a href={nav} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1557B0] px-4 font-bold text-white"><Navigation className="h-4 w-4"/>Fastest route to call</a>:null}</div></div></section>;
}
