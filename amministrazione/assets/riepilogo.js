import {today,escapeHTML as esc,number,displayDate,summarize,csv,download,validDay} from './helpers.js?v=f8ee9f823b48';
import {COMPILERS,compilerOf,isPresent,datesBetween,dateShift,periodRange,monthShift,employeeDay,profileURL,registerURL,siteNames,siteLinks,siteLink,statCards} from './registri.js?v=f8ee9f823b48';

export async function initReport(ctx){
 const {$,client,check,allRows,masters,run,status}=ctx;
 let data={days:[],attendance:[],worklogs:[],activities:[]},rows=[],dates=[],summary=[],start='',end='',selected=today(),loadedDate=today(),loadedView='month';
 const query=new URLSearchParams(location.search),requested=query.get('giorno');
 $('report-date').value=requested&&validDay(requested)?requested:today();
 $('report-compiler').value=COMPILERS.includes(query.get('compilatore'))?query.get('compilatore'):'';
 function people(){const term=$('report-search').value.trim().toLocaleLowerCase('it');return masters.employees.filter(e=>(e.active||rows.some(r=>r.employee_id===e.id))&&`${e.name} ${e.code||''}`.toLocaleLowerCase('it').includes(term));}
 function renderDay(){
  $('report-day-title').textContent='Giornata del '+displayDate(selected);
  const comps=$('report-compiler').value?[$('report-compiler').value]:COMPILERS;
  $('report-day-links').innerHTML=comps.map(c=>`<a class="button secondary small" href="${esc(registerURL(selected,c))}">Modifica ${esc(c)}</a>`).join('');
  const list=people().filter(e=>employeeDay(rows,e.id,selected).recorded);
  $('report-day-list').innerHTML=list.length?`<ul class="selection-list">${list.map(e=>{
   const r=employeeDay(rows,e.id,selected),compiler=$('report-compiler').value||r.entries.find(isPresent)?.compiler||'Ufficio';
   return `<li><div><strong>${esc(e.name)}</strong><p>${r.hours>0?number(r.hours)+' ore · Presente':'0 ore · Assente'}</p><p class="mini">${siteLinks(e.id,selected,rows,data.days,data.worklogs,data.activities,masters)}</p><p class="mini">${r.entries.map(x=>esc(compilerOf(x))+': '+number(x.hours)+' h').join(' · ')}</p></div><a class="button secondary small" href="${esc(profileURL(e.id,selected,compiler))}">Scheda / modifica</a></li>`;
  }).join('')}</ul>`:'<div class="empty">Nessuna registrazione per questo giorno e questi filtri. Apri un registro per compilare le presenze.</div>';
 }
 function render(){
  const compiler=$('report-compiler').value;
  rows=data.attendance.filter(r=>!compiler||compilerOf(r)===compiler);
  const employees=people(),ids=new Set(employees.map(e=>e.id)),filtered=rows.filter(r=>ids.has(r.employee_id));
  summary=summarize(filtered,employees);
  const total=summary.reduce((s,e)=>s+e.hours,0),present=summary.reduce((s,e)=>s+e.days,0);
  $('report-stats').innerHTML=statCards([['Giornate operaio',number(present)],['Ore lavorate',number(total)],['Operai presenti nel periodo',summary.filter(e=>e.days>0).length]]);
  const metric=$('report-metric').value,points=dates.map(day=>{const r=filtered.filter(r=>r.day===day&&isPresent(r));return {day,people:new Set(r.map(x=>x.employee_id)).size,hours:r.reduce((s,r)=>s+Number(r.hours),0)};}),max=Math.max(1,...points.map(p=>p[metric]));
  $('report-chart-title').textContent=metric==='people'?'Operai presenti ogni giorno':'Ore lavorate ogni giorno';
  $('report-chart').innerHTML=`<div class="bar-chart">${points.map(p=>{const value=p[metric],height=Math.round(value/max*90),label=`${displayDate(p.day)}: ${p.people} operai, ${number(p.hours)} ore`;
   return `<button type="button" class="chart-day ${selected===p.day?'selected':''}" data-day="${p.day}" aria-label="${esc(label)}" aria-pressed="${selected===p.day}"><span class="chart-value">${number(value)}</span><svg viewBox="0 0 24 100" width="24" height="100" aria-hidden="true"><rect class="chart-track" x="0" y="0" width="24" height="100" rx="4"/><rect class="chart-bar" x="0" y="${100-height}" width="24" height="${height}" rx="3"/></svg><span>${Number(p.day.slice(-2))}</span><span class="chart-weekday">${new Intl.DateTimeFormat('it',{weekday:'short',timeZone:'UTC'}).format(new Date(p.day+'T12:00:00Z'))}</span></button>`;
  }).join('')}</div>`;
  $('report-summary').innerHTML=summary.length?`<div class="table-scroll" role="region" aria-label="Totali per operaio" tabindex="0"><table><thead><tr><th>Operaio</th><th class="numeric">Giorni presenti</th><th class="numeric">Ore</th><th class="numeric">Giorni eq. / 8 h</th></tr></thead><tbody>${summary.map(e=>`<tr><td><a href="${esc(profileURL(e.id,selected,compiler||'Ufficio'))}">${esc(e.name)}</a>${e.code?'<br><span class="mini">'+esc(e.code)+'</span>':''}</td><td class="numeric">${e.days}</td><td class="numeric">${number(e.hours)}</td><td class="numeric">${number(e.equivalent)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Nessun operaio corrispondente.</div>';
  $('report-daily-table').innerHTML=`<div class="table-scroll" role="region" aria-label="Riepilogo di ogni giorno" tabindex="0"><table><thead><tr><th>Data</th><th>Operai presenti e ore</th><th class="numeric">Presenti</th><th class="numeric">Ore</th></tr></thead><tbody>${points.map(p=>`<tr><td><button type="button" class="secondary small" data-day="${p.day}">${displayDate(p.day)}</button></td><td class="wrap">${employees.map(e=>({e,r:employeeDay(filtered,e.id,p.day)})).filter(x=>x.r.hours>0).map(({e,r})=>`<a href="${esc(profileURL(e.id,p.day,compiler||r.entries.find(isPresent)?.compiler||'Ufficio'))}">${esc(e.name)}</a> · ${number(r.hours)} h`).join('<br>')||'Nessun presente'}</td><td class="numeric">${p.people}</td><td class="numeric">${number(p.hours)}</td></tr>`).join('')}</tbody></table></div>`;
  renderDay();
 }
 async function load(){
  const date=$('report-date').value,view=$('report-view').value,[a,b]=periodRange(date,view);
  if(!validDay(a)||!validDay(b))throw new Error('Periodo fuori dall’intervallo 2000–2100');
  const result=await Promise.all(['days','attendance','worklogs','activities'].map(async t=>[t,await allRows(client,t,q=>q.gte('day',a).lte('day',b).order('day').order('compiler').order(t==='days'?'day':'employee_id'))]));
  data=Object.fromEntries(result);start=a;end=b;dates=datesBetween(a,b);loadedDate=date;loadedView=view;
  if(selected<a||selected>b)selected=date;
  $('report-range').textContent=`${displayDate(a)} – ${displayDate(b)} · ${view==='week'?'Settimana':'Mese'}`;
  render();
 }
 async function reload(){try{await load();}catch(e){$('report-date').value=loadedDate;$('report-view').value=loadedView;throw e;}}
 await load();
 $('report-filters').addEventListener('submit',e=>{e.preventDefault();run(e.submitter,reload);});
 for(const id of ['report-view','report-date'])$(id).addEventListener('change',()=>run(null,reload));
 for(const id of ['report-compiler','report-metric','report-search'])$(id).addEventListener('input',render);
 for(const [id,delta] of [['report-prev',-1],['report-next',1]])$(id).addEventListener('click',()=>run($(id),async()=>{
  const next=loadedView==='week'?dateShift(loadedDate,delta*7):monthShift(loadedDate.slice(0,7),delta)+'-01';
  if(!validDay(next)){status('Limite del calendario: 2000–2100.','warning');return;}$('report-date').value=next;await reload();
 }));
 function choose(e){const btn=e.target.closest('[data-day]');if(!btn)return;selected=btn.dataset.day;render();$('day-detail').scrollIntoView({block:'start',behavior:'auto'});}
 $('report-chart').addEventListener('click',choose);$('report-daily-table').addEventListener('click',choose);
 $('report-export').addEventListener('click',()=>download(`riepilogo-${start}-${end}.csv`,csv([['Dal','Al','Registri','Codice','Operaio','Giorni presenti (>0 ore)','Ore','Giorni equivalenti (ore/8)'],...summary.map(e=>[start,end,$('report-compiler').value||'Tutti (ore sommate)',e.code,e.name,e.days,String(e.hours).replace('.',','),String(e.equivalent).replace('.',',')])]),'text/csv;charset=utf-8'));
 $('report-export-days').addEventListener('click',()=>{
  const table=[['Data','Codice','Operaio','Presente (>0 ore)','Ore','Cantieri','Registri']];
  for(const day of dates)for(const e of people()){const r=employeeDay(rows,e.id,day);if(r.recorded)table.push([day,e.code,e.name,r.hours>0?'Sì':'No',String(r.hours).replace('.',','),siteNames(e.id,day,rows,data.days,data.worklogs,data.activities,masters),r.entries.map(x=>compilerOf(x)+': '+number(x.hours)+' h').join(' | ')]);}
  download(`presenze-giorno-${start}-${end}.csv`,csv(table),'text/csv;charset=utf-8');
 });
}
