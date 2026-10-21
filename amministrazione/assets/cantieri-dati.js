import {compilerOf,isPresent,key} from './registri.js?v=f8ee9f823b48';

export function activitySite(a,main,locations){return a.site_id||locations.find(l=>l.id===a.location_id)?.site_id||main||null;}
// Ripartisce solo quando il totale delle fasce coincide con le ore registrate.
// Una correzione manuale non viene suddivisa proporzionalmente o contata due volte.
export function allocateAttendance(rows,days,logs,activities,locations){
 const dayMap=new Map(days.map(d=>[`${d.day}|${compilerOf(d)}`,d])),logMap=new Map(logs.map(l=>[key(l),l])),groups=new Map(),entries=[],issues=[];
 for(const a of activities){const k=key(a);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(a);}
 for(const r of rows.filter(isPresent)){
  const log=logMap.get(key(r)),main=log?log.site_id:dayMap.get(`${r.day}|${compilerOf(r)}`)?.site_id,slots=(groups.get(key(r))||[]).filter(a=>a.kind!=='pausa'),total=slots.reduce((s,a)=>s+(Number(a.end_minute)-Number(a.start_minute))/60,0),hours=Number(r.hours),split=new Map();
  const exact=slots.length>0&&Math.abs(total-hours)<0.001;
  if(exact){for(const a of slots){const id=activitySite(a,main,locations);if(id)split.set(id,(split.get(id)||0)+(Number(a.end_minute)-Number(a.start_minute))/60);}}
  else{if(main)split.set(main,hours);if(slots.length)issues.push({row:r,sites:[...new Set([main,...slots.map(a=>activitySite(a,main,locations))].filter(Boolean))],hours,activityHours:total});}
  for(const [site_id,part]of split)if(part>0)entries.push({...r,site_id,hours:part,register_hours:hours,source:exact?'attività':'registro'});
 }
 return{entries,issues};
}
export function siteSummary(entries,site){const rows=entries.filter(r=>r.site_id===site);return {rows,hours:rows.reduce((s,r)=>s+Number(r.hours),0),workerDays:new Set(rows.map(r=>r.day+'|'+r.employee_id)).size,workers:new Set(rows.map(r=>r.employee_id)).size};}
