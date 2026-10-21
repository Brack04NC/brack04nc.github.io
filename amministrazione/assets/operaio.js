import {today,validDay,monthRange,escapeHTML as esc,number,displayDate,timestamp} from './helpers.js?v=f8ee9f823b48';
import {COMPILERS,compilerOf,isPresent,key,datesBetween,monthShift,employeeDay,registerURL,siteNames,siteLinks,siteLink,timeLabel,KINDS,activityTotals,validateActivities,statCards} from './registri.js?v=f8ee9f823b48';

export async function initWorker(ctx){
 const {$,client,check,allRows,masters,run,status,setDirty,canDiscard,refreshMasters}=ctx;
 const query=new URLSearchParams(location.search);
 let employee=masters.employees.find(e=>e.id===query.get('operaio'))?.id||masters.employees.find(e=>e.active)?.id||masters.employees[0]?.id||'',day=validDay(query.get('giorno')||'')?query.get('giorno'):today(),compiler=COMPILERS.includes(query.get('compilatore'))?query.get('compilatore'):'Ufficio';
 let month=day.slice(0,7),data={attendance:[],days:[],worklogs:[],activities:[]},dayRevision=0,logRevision=0,slots=[],loaded=false;
 const employeeRows=()=>data.attendance.filter(r=>r.employee_id===employee&&(!$('worker-calendar-compiler').value||compilerOf(r)===$('worker-calendar-compiler').value));
 const recordKey=()=>({day,compiler,employee_id:employee});
 function options(rows,selected,blank='Non specificato'){return `<option value="">${blank}</option>`+rows.map(r=>`<option value="${esc(r.id)}" ${r.id===selected?'selected':''}>${esc(r.name)}${r.plate?' · '+esc(r.plate):''}${r.active?'':' (archiviato)'}</option>`).join('');}
 function timeOptions(value,end=false){return Array.from({length:end?97:96},(_,i)=>i*15).map(n=>`<option value="${n}" ${n===Number(value)?'selected':''}>${timeLabel(n)}</option>`).join('');}
 function renderCalendar(){
  const rows=employeeRows(),[a,b]=monthRange(month),dates=datesBetween(a,b),offset=(new Date(a+'T12:00:00Z').getUTCDay()+6)%7;
  const person=masters.employees.find(e=>e.id===employee),hours=rows.filter(isPresent).reduce((s,r)=>s+Number(r.hours),0),days=new Set(rows.filter(isPresent).map(r=>r.day)).size;
  $('worker-identity').textContent=person?`${person.name}${person.code?' · '+person.code:''}${person.active?'':' · Archiviato'}`:'Nessun operaio. Aggiungilo nelle anagrafiche.';
  $('worker-stats').innerHTML=statCards([['Giorni presenti nel mese',days],['Ore lavorate nel mese',number(hours)],['Giorni equivalenti / 8 h',number(hours/8)]]);
  $('worker-calendar-title').textContent=new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(a+'T12:00:00Z'));
  $('worker-calendar').innerHTML=Array.from({length:offset},()=>'<span class="calendar-blank" aria-hidden="true"></span>').join('')+dates.map(d=>{
   const r=employeeDay(rows,employee,d),state=r.hours>0?'present':r.recorded?'absent':'unrecorded',sites=siteNames(employee,d,rows,data.days,data.worklogs,data.activities,masters),label=`${displayDate(d)}: ${r.hours>0?number(r.hours)+' ore, '+sites:r.recorded?'assente, zero ore':'nessuna registrazione'}`;
   return `<button type="button" class="calendar-day ${state} ${day===d?'selected':''}" data-worker-day="${d}" aria-label="${esc(label)}" aria-pressed="${day===d}" title="${esc(label)}"><strong>${Number(d.slice(-2))}</strong><span>${r.hours>0?number(r.hours)+' h':r.recorded?'0 h':'—'}</span></button>`;
  }).join('');
 }
 function updateURL(){history.replaceState(null,'',`operaio.html?operaio=${encodeURIComponent(employee)}&giorno=${day}&compilatore=${encodeURIComponent(compiler)}`);}
 function updateTotals(){
  const t=activityTotals(slots),auto=$('worker-mode').value==='activities';
  $('worker-hours').readOnly=auto;if(auto)$('worker-hours').value=String(t.work/60);
  $('activity-summary').textContent=`Attività lavorative: ${number(t.work/60)} h · Pause escluse: ${number(t.break/60)} h · Presenza da salvare: ${number($('worker-hours').value)} h`;
  const hours=Number($('worker-hours').value),different=slots.length>0&&!auto&&Math.abs(hours-t.work/60)>0.001;
  $('activity-mismatch').hidden=!different;
  $('activity-mismatch').textContent=`Totale manuale ${number(hours)} h diverso dalle attività (${number(t.work/60)} h). Se è una correzione intenzionale puoi salvarla; altrimenti scegli il calcolo automatico o modifica le fasce.`;
  $('worker-timeline').innerHTML=slots.length?'<p class="eyebrow">Inizio turno</p><ol>'+[...slots].sort((a,b)=>a.start_minute-b.start_minute).map(s=>`<li class="${s.kind==='pausa'?'break':''}"><strong>${timeLabel(Number(s.start_minute))}–${timeLabel(Number(s.end_minute))}</strong><span>${esc(KINDS[s.kind])}</span>${s.site_id?'<span class="mini">'+siteLink(s.site_id,masters)+'</span>':''}${s.location_id?'<span class="mini">'+esc(masters.locations.find(x=>x.id===s.location_id)?.name||'')+'</span>':''}${s.notes?'<p>'+esc(s.notes)+'</p>':''}</li>`).join('')+'</ol><p class="eyebrow">Fine turno</p>':'<p class="hint">Nessuna fascia oraria. Puoi registrare anche solo il totale delle ore.</p>';
 }
 function changed(){setDirty();$('worker-save-state').textContent='Modifiche da salvare.';updateTotals();}
 function renderSlots(){
  $('worker-activities').innerHTML=slots.map((s,i)=>`<fieldset class="activity-card" data-slot="${i}"><legend>Fascia ${i+1}</legend><div class="grid three"><div class="field"><label for="slot-start-${i}">Dalle</label><select id="slot-start-${i}" data-field="start_minute">${timeOptions(s.start_minute)}</select></div><div class="field"><label for="slot-end-${i}">Alle</label><select id="slot-end-${i}" data-field="end_minute">${timeOptions(s.end_minute,true)}</select></div><div class="field"><label for="slot-kind-${i}">Attività</label><select id="slot-kind-${i}" data-field="kind">${Object.entries(KINDS).map(([k,l])=>`<option value="${k}" ${k===s.kind?'selected':''}>${esc(l)}</option>`).join('')}</select></div><div class="field"><label for="slot-site-${i}">Cantiere</label><select id="slot-site-${i}" data-field="site_id">${options(masters.sites.filter(x=>x.active||x.id===s.site_id),s.site_id)}</select></div><div class="field"><label for="slot-location-${i}">Magazzino / camion / ubicazione</label><select id="slot-location-${i}" data-field="location_id">${options(masters.locations.filter(x=>x.active||x.id===s.location_id),s.location_id)}</select></div><div class="field full"><label for="slot-note-${i}">Note attività</label><textarea id="slot-note-${i}" data-field="notes" maxlength="1000" rows="2">${esc(s.notes)}</textarea></div></div><button type="button" class="secondary small" data-remove-slot="${i}">Rimuovi fascia ${i+1}</button></fieldset>`).join('');updateTotals();
 }
 function fillEditor(){
  const record=data.days.find(r=>r.day===day&&compilerOf(r)===compiler),log=data.worklogs.find(r=>key(r)===key(recordKey())),attendance=data.attendance.find(r=>key(r)===key(recordKey()));
  dayRevision=record?.revision||0;logRevision=log?.revision||0;
  slots=data.activities.filter(r=>key(r)===key(recordKey())).sort((a,b)=>a.start_minute-b.start_minute).map(r=>({start_minute:Number(r.start_minute),end_minute:Number(r.end_minute),kind:r.kind,site_id:r.site_id||null,location_id:r.location_id||null,notes:r.notes||''}));
  $('worker-day').value=day;$('worker-compiler').value=compiler;$('worker-month').value=month;$('worker-select').value=employee;
  const selectedSite=log?log.site_id:record?.site_id;
  $('worker-site').innerHTML=options(masters.sites.filter(s=>s.active||s.id===selectedSite),selectedSite);
  // Se il totale è stato corretto dal registro giornaliero, conservarlo esplicitamente in modalità manuale.
  const mode=log?.hours_mode||'manual',totals=activityTotals(slots);
  $('worker-mode').value=mode==='activities'&&Number(attendance?.hours||0)!==totals.work/60?'manual':mode;
  $('worker-hours').value=attendance?.hours||0;
  $('worker-day-title').textContent=`${displayDate(day)} · ${compiler}`;
  $('worker-register-link').href=registerURL(day,compiler);
  $('worker-save-state').textContent=attendance?(isPresent(attendance)?'Presenza registrata.':'Assenza registrata · 0 ore.'):'Nessuna registrazione per questo operaio e registro.';
  $('worker-updated').textContent=log?`Scheda rev. ${log.revision} · Registro rev. ${dayRevision} · ${timestamp(log.updated_at)}`:record?`Registro rev. ${dayRevision} · ${timestamp(record.updated_at)}`:'Giornata da compilare.';
  const regs=data.attendance.filter(r=>r.employee_id===employee&&r.day===day);
  $('worker-day-registers').innerHTML='<h3>Registri del '+displayDate(day)+'</h3>'+(regs.length?'<ul class="selection-list">'+regs.map(r=>`<li><div><strong>${esc(compilerOf(r))} · ${number(r.hours)} h</strong><p class="mini">${siteLinks(employee,day,[r],data.days,data.worklogs,data.activities,masters)}</p></div><button class="secondary small" type="button" data-worker-compiler="${esc(compilerOf(r))}">Apri registro</button></li>`).join('')+'</ul>':'<p class="hint">Nessuna registrazione in questa data.</p>');
  setDirty(false);renderSlots();renderCalendar();updateURL();
 }
 async function load(nextMonth=month){
  const [a,b]=monthRange(nextMonth),result=await Promise.all(['attendance','days','worklogs','activities'].map(async t=>[t,await allRows(client,t,q=>{q=q.gte('day',a).lte('day',b);if(t!=='days')q=q.eq('employee_id',employee);return q.order('day').order('compiler').order(t==='days'?'day':'employee_id');})]));
  data=Object.fromEntries(result);month=nextMonth;loaded=true;fillEditor();
 }
 $('worker-select').innerHTML=masters.employees.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}${e.active?'':' (archiviato)'}</option>`).join('');
 if(!employee){$('worker-editor').hidden=true;$('worker-calendar').innerHTML='<p>Aggiungi almeno un operaio nelle <a href="anagrafiche.html">anagrafiche</a>.</p>';for(const e of document.querySelectorAll('#page-content input,#page-content select,#page-content button'))e.disabled=true;return;}
 await load();
 async function change(toDay=day,toCompiler=compiler,toEmployee=employee,toMonth=toDay.slice(0,7)){
  const previous={day,compiler,employee,month};
  if(!canDiscard()){$('worker-day').value=day;$('worker-compiler').value=compiler;$('worker-select').value=employee;$('worker-month').value=month;return;}
  if(!validDay(toDay)){$('worker-day').value=day;status('Data non valida.','error');return;}
  day=toDay;compiler=toCompiler;employee=toEmployee;
  try{if(toMonth!==month||employee!==previous.employee)await load(toMonth);else fillEditor();}catch(e){({day,compiler,employee,month}=previous);$('worker-day').value=day;$('worker-compiler').value=compiler;$('worker-select').value=employee;$('worker-month').value=month;throw e;}
 }
 $('worker-select').addEventListener('change',()=>run(null,()=>change(day,compiler,$('worker-select').value)));
 $('worker-day').addEventListener('change',()=>run(null,()=>change($('worker-day').value)));
 $('worker-compiler').addEventListener('change',()=>run(null,()=>change(day,$('worker-compiler').value)));
 $('worker-month').addEventListener('change',()=>run(null,()=>change($('worker-month').value+'-01',compiler,employee,$('worker-month').value)));
 $('worker-calendar-compiler').addEventListener('change',renderCalendar);
 for(const [id,delta] of [['worker-prev',-1],['worker-next',1]])$(id).addEventListener('click',()=>run($(id),()=>change(monthShift(month,delta)+'-01')));
 $('worker-refresh').addEventListener('click',()=>{if(canDiscard())run($('worker-refresh'),async()=>{await refreshMasters();await load();status('Scheda ricaricata.','success');});});
 $('worker-calendar').addEventListener('click',e=>{const b=e.target.closest('[data-worker-day]');if(b)run(null,async()=>{await change(b.dataset.workerDay);$('worker-editor').scrollIntoView({block:'start'});});});
 $('worker-day-registers').addEventListener('click',e=>{const b=e.target.closest('[data-worker-compiler]');if(b)run(null,()=>change(day,b.dataset.workerCompiler));});
 for(const id of ['worker-site','worker-mode','worker-hours'])$(id).addEventListener('input',changed);
 $('worker-activities').addEventListener('input',e=>{const field=e.target.dataset.field,row=e.target.closest('[data-slot]');if(!field||!row)return;slots[Number(row.dataset.slot)][field]=['start_minute','end_minute'].includes(field)?Number(e.target.value):e.target.value||(['site_id','location_id'].includes(field)?null:'');changed();});
 $('worker-activities').addEventListener('click',e=>{const b=e.target.closest('[data-remove-slot]');if(!b)return;slots.splice(Number(b.dataset.removeSlot),1);renderSlots();changed();});
 $('activity-add').addEventListener('click',()=>{if(slots.length>=96){status('Massimo 96 fasce al giorno.','warning');return;}const last=Math.max(420,...slots.map(s=>s.end_minute)),start=Math.min(last,1425);slots.push({start_minute:start,end_minute:Math.min(start+60,1440),kind:'lavoro',site_id:$('worker-site').value||null,location_id:null,notes:''});renderSlots();changed();});
 $('activity-example').addEventListener('click',()=>{
  if(slots.length&&!window.confirm('Sostituire le fasce della giornata con l’esempio? Le modifiche saranno salvate solo premendo Salva.'))return;
  slots=[[420,480,'magazzino','Carico merce'],[480,600,'viaggio','Verso il cantiere e scarico merce'],[600,720,'lavoro','Lavoro in cantiere'],[720,840,'pausa','Pausa'],[840,900,'viaggio','Sistemazione e ritorno in magazzino'],[900,960,'magazzino','Scarico camion in magazzino']].map(([start_minute,end_minute,kind,notes])=>({start_minute,end_minute,kind,notes,site_id:kind==='lavoro'?$('worker-site').value||null:null,location_id:null}));
  $('worker-mode').value='activities';renderSlots();changed();
 });
 async function save(remove=false,zero=false){
  const list=zero?[]:slots,mode=zero?'manual':$('worker-mode').value,hours=zero?0:Number($('worker-hours').value);
  try{validateActivities(list);if(!Number.isFinite(hours)||hours<0||hours>24||hours%0.25)throw new Error('Ore non valide: da 0 a 24, in frazioni di 0,25.');}catch(e){status(e.message,'error');return;}
  const result=check(await client.rpc('gest_save_worker_day',{p_day:day,p_compiler:compiler,p_employee:employee,p_hours:hours,p_site:$('worker-site').value||null,p_activities:list,p_mode:mode,p_day_revision:dayRevision,p_log_revision:logRevision,p_remove:remove}));
  dayRevision=result.day_revision;logRevision=result.log_revision;setDirty(false);
  const message=remove?'Registrazione eliminata. Zero presenze conteggiate.':zero?'Assenza salvata: 0 ore, nessuna presenza conteggiata.':'Giornata operaio salvata: '+number(result.hours)+' ore.';
  try{await load();status(message,'success');}catch{status(message+' Ricarica la scheda per aggiornare calendario e revisioni.','warning');$('worker-save').disabled=true;}
 }
 $('worker-form').addEventListener('submit',e=>{e.preventDefault();if(loaded)run(e.submitter,()=>save());});
 for(const [id,remove] of [['worker-absent',false],['worker-delete',true]])$(id).addEventListener('click',()=>{
  const name=masters.employees.find(e=>e.id===employee)?.name||'operaio';
  if(!window.confirm(`${remove?'Eliminare la registrazione':'Segnare assente'} di ${name} del ${displayDate(day)} · ${compiler}? Verranno rimosse tutte le fasce di questo registro e le ore saranno azzerate.`))return;
  run($(id),()=>save(remove,true));
 });
}
