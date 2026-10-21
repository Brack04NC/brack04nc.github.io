import {escapeHTML as esc,number,displayDate,validDay} from './helpers.js?v=f8ee9f823b48';
export const COMPILERS=['Ufficio','Tecnico 1','Tecnico 2'];
export const compilerOf=r=>r.compiler||'Ufficio';
export const isPresent=r=>!!r.present&&Number(r.hours)>0;
export const key=r=>`${r.day}|${compilerOf(r)}|${r.employee_id}`;
export function dateShift(day,amount){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+amount);return d.toISOString().slice(0,10);}
export function datesBetween(start,end){const rows=[];for(let d=start;d<=end;d=dateShift(d,1))rows.push(d);return rows;}
export function periodRange(day,view){
  if(!validDay(day))throw new Error('Data non valida');
  if(view==='week'){const wd=new Date(day+'T12:00:00Z').getUTCDay(),start=dateShift(day,-((wd+6)%7));return [start,dateShift(start,6)];}
  const [y,m]=day.split('-').map(Number);return [day.slice(0,7)+'-01',`${y}-${String(m).padStart(2,'0')}-${new Date(Date.UTC(y,m,0)).getUTCDate()}`];
}
export function monthShift(month,amount){const [y,m]=month.split('-').map(Number),d=new Date(Date.UTC(y,m-1+amount,1,12));return d.toISOString().slice(0,7);}
export function employeeDay(rows,id,day){const entries=rows.filter(r=>r.employee_id===id&&r.day===day);return {entries,hours:entries.reduce((s,r)=>s+(isPresent(r)?Number(r.hours):0),0),recorded:entries.length>0};}
export function profileURL(id,day,compiler='Ufficio'){return `operaio.html?operaio=${encodeURIComponent(id)}${day?'&giorno='+encodeURIComponent(day):''}&compilatore=${encodeURIComponent(compiler)}`;}
export function registerURL(day,compiler='Ufficio'){return `presenze.html?giorno=${encodeURIComponent(day)}&compilatore=${encodeURIComponent(compiler)}`;}
export const timeLabel=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
export const KINDS={lavoro:'Lavoro in cantiere',magazzino:'Magazzino / carico e scarico',viaggio:'Viaggio / trasferimento',pausa:'Pausa (esclusa dalle ore)',altro:'Altra attività lavorativa'};
export function activityTotals(slots){return slots.reduce((r,a)=>{const n=Number(a.end_minute)-Number(a.start_minute);if(n>0&&Number.isFinite(n)){r[a.kind==='pausa'?'break':'work']+=n;}return r;},{work:0,break:0});}
export function validateActivities(slots){
  let end=-1;
  for(const a of [...slots].sort((a,b)=>a.start_minute-b.start_minute)){
    if(!Number.isInteger(a.start_minute)||!Number.isInteger(a.end_minute)||a.start_minute<0||a.end_minute>1440||a.end_minute<=a.start_minute||a.start_minute%15||a.end_minute%15||a.start_minute<end||!KINDS[a.kind]||a.notes.length>1000)throw new Error('Controlla le fasce: intervalli validi di 15 minuti, senza sovrapposizioni.');
    end=a.end_minute;
  }
  if(slots.length>96)throw new Error('Massimo 96 fasce al giorno.');
  return slots;
}
function siteIDs(id,day,rows,days,logs,activities,masters){
  const ids=new Set();
  for(const r of rows.filter(r=>r.day===day&&r.employee_id===id&&isPresent(r))){
    const log=logs.find(l=>key(l)===key(r));
    const site=log?log.site_id:days.find(d=>d.day===day&&compilerOf(d)===compilerOf(r))?.site_id;
    if(site)ids.add(site);
    activities.filter(a=>key(a)===key(r)&&a.kind!=='pausa').forEach(a=>{const site=a.site_id||masters.locations.find(l=>l.id===a.location_id)?.site_id;if(site)ids.add(site);});
  }
  return [...ids];
}
export function siteNames(...args){const masters=args[6];return siteIDs(...args).map(s=>masters.sites.find(x=>x.id===s)?.name||'Cantiere archiviato').join(' · ')||'Non specificato';}
export function siteLink(id,masters){return id?`<a href="cantieri.html?cantiere=${encodeURIComponent(id)}">${esc(masters.sites.find(s=>s.id===id)?.name||'Cantiere archiviato')}</a>`:'Non specificato';}
export function siteLinks(...args){return siteIDs(...args).map(id=>siteLink(id,args[6])).join(' · ')||'Non specificato';}
export function statCards(stats){return stats.map(([l,v])=>`<div class="stat"><span>${esc(l)}</span><strong>${esc(v)}</strong></div>`).join('');}
export function dateLabel(day){return displayDate(day);}
export function hoursLabel(hours){return number(hours)+' h';}
