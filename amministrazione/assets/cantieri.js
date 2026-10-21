import {today,validDay,monthRange,escapeHTML as esc,number,displayDate,unitLabel,csv,download} from './helpers.js?v=f8ee9f823b48';
import {compilerOf,key,isPresent,profileURL,registerURL,timeLabel,KINDS,statCards} from './registri.js?v=f8ee9f823b48';
import {activitySite,allocateAttendance,siteSummary} from './cantieri-dati.js?v=f8ee9f823b48';

export async function initSites(ctx){
 const {$,client,check,allRows,masters,status,run,setDirty,canDiscard,refreshMasters}=ctx;
 let selected=null,data={days:[],attendance:[],logs:[],activities:[],balances:[]},period=[],allocation={entries:[],issues:[]},masterDirty=false,locationDirty=false,newLocation=crypto.randomUUID();
 const person=id=>masters.employees.find(e=>e.id===id)?.name||'Persona archiviata';
 const linked=()=>masters.locations.filter(l=>l.site_id===selected?.id);
 const dirty=()=>setDirty(masterDirty||locationDirty);
 const siteURL=id=>'cantieri.html?cantiere='+encodeURIComponent(id);
 const empty=message=>'<div class="empty">'+message+'</div>';
 const table=(label,heads,rows)=>rows.length?`<div class="table-scroll" tabindex="0" role="region" aria-label="${esc(label)}"><table><thead><tr>${heads.map(h=>'<th>'+esc(h)+'</th>').join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`:empty('Nessun dato nel periodo selezionato.');
 function directory(){
  const term=$('sites-search').value.trim().toLocaleLowerCase('it'),state=$('sites-state').value;
  const rows=masters.sites.filter(s=>(state==='all'||(state==='active'?s.active:!s.active))&&s.name.toLocaleLowerCase('it').includes(term));
  $('sites-count').textContent=rows.length+' cantieri';
  $('sites-list').innerHTML=rows.length?'<ul class="selection-list">'+rows.map(s=>`<li><div><strong>${esc(s.name)}</strong><p class="mini">${s.active?'Attivo':'Archiviato'}</p></div><button type="button" class="secondary small" data-open-site="${esc(s.id)}" aria-label="Apri scheda ${esc(s.name)}">Apri scheda</button></li>`).join('')+'</ul>':empty('Nessun cantiere corrispondente ai filtri.');
 }
 function title(){ $('site-title').textContent=selected.name;$('site-state').textContent=selected.active?'Attivo':'Archiviato';document.title=selected.name+' | Amministrazione Ponteggi'; }
 function quickLink(){
  const day=$('site-quick-day').value;
  $('site-open-register').href=validDay(day)?registerURL(day,$('site-quick-compiler').value)+'&cantiere='+encodeURIComponent(selected.id):'presenze.html';
 }
 function locationFields(){
  const isNew=!$('site-location-select').value;
  $('site-location-name-field').hidden=!isNew;$('site-location-name').required=isNew;
 }
 function resetLocationForm(){
  $('site-location-select').innerHTML='<option value="">Crea una nuova ubicazione</option>'+masters.locations.filter(l=>l.active&&l.kind==='cantiere'&&!l.site_id).map(l=>`<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('');
  $('site-location-name').value=('Cantiere · '+selected.name).slice(0,120);newLocation=crypto.randomUUID();locationDirty=false;locationFields();dirty();
 }
 function renderMaterials(){
  const locations=linked();
  const stock=data.balances.filter(b=>Number(b.quantity)>0&&locations.some(l=>l.id===b.location_id));
  $('site-stock').innerHTML=locations.length?(stock.length?table('Giacenze del cantiere',['Materiale','Ubicazione','Quantità'],stock.map(b=>{
   const m=masters.materials.find(m=>m.id===b.material_id),l=locations.find(l=>l.id===b.location_id);
   return `<tr><td><a href="materiali.html?materiale=${encodeURIComponent(b.material_id)}">${esc(m?.name||'Materiale archiviato')}</a></td><td><a href="deposito.html?ubicazione=${encodeURIComponent(l.id)}">${esc(l.name)}</a></td><td class="numeric">${number(b.quantity)} ${esc(unitLabel(m?.unit||''))}</td></tr>`;
  })):empty('Nessun materiale in giacenza nelle ubicazioni collegate.')):empty('Collega o crea un’ubicazione di deposito per vedere i materiali di questo cantiere.');
  $('site-locations').innerHTML=locations.length?'<ul class="selection-list">'+locations.map(l=>`<li><div><strong>${esc(l.name)}</strong><p class="mini">${l.active?'Attiva':'Archiviata'}</p><a href="deposito.html?ubicazione=${encodeURIComponent(l.id)}">Movimenti e giacenze</a></div><button type="button" class="secondary small" data-unlink="${esc(l.id)}" aria-label="Scollega ${esc(l.name)}">Scollega</button></li>`).join('')+'</ul>':empty('Nessuna ubicazione collegata.');
 }
 async function readBalances(){const ids=linked().map(l=>l.id);return ids.length?await allRows(client,'balances',q=>q.in('location_id',ids).order('material_id').order('location_id')):[];}
 function render(){
  const compiler=$('site-compiler').value,keep=r=>!compiler||compilerOf(r)===compiler;
  const rows=data.attendance.filter(keep),days=data.days.filter(keep),logs=data.logs.filter(keep),activities=data.activities.filter(keep);
  allocation=allocateAttendance(rows,days,logs,activities,masters.locations);
  const summary=siteSummary(allocation.entries,selected.id),issues=allocation.issues.filter(i=>i.sites.includes(selected.id));
  $('site-stats').innerHTML=statCards([['Ore nel cantiere',number(summary.hours)],['Presenze (persona / giorno)',summary.workerDays],['Operai nel periodo',summary.workers]]);
  $('site-allocation-warning').hidden=!issues.length;
  $('site-allocation-warning').textContent=issues.length?`${issues.length} registrazioni hanno ore manuali diverse dalle fasce: ${issues.map(i=>person(i.row.employee_id)+' · '+displayDate(i.row.day)+' · '+compilerOf(i.row)).join('; ')}. Il totale manuale resta sul cantiere principale. Apri la scheda operaio per verificare.`:'';
  const workers=[...new Set(summary.rows.map(r=>r.employee_id))].map(id=>{
   const entries=summary.rows.filter(r=>r.employee_id===id),hours=entries.reduce((s,r)=>s+r.hours,0),latest=[...entries].sort((a,b)=>b.day.localeCompare(a.day))[0];
   return {id,entries,hours,latest};
  }).sort((a,b)=>person(a.id).localeCompare(person(b.id),'it'));
  $('site-workers').innerHTML=table('Operai nel cantiere',['Operaio','Giorni presenti','Ore nel cantiere','Dettaglio'],workers.map(w=>`<tr><td>${esc(person(w.id))}</td><td class="numeric">${new Set(w.entries.map(r=>r.day)).size}</td><td class="numeric">${number(w.hours)}</td><td><a href="${esc(profileURL(w.id,w.latest.day,compilerOf(w.latest)))}">Scheda operaio e calendario</a></td></tr>`));
  const regKeys=new Set(days.filter(d=>d.site_id===selected.id).map(d=>d.day+'|'+compilerOf(d)));
  summary.rows.forEach(r=>regKeys.add(r.day+'|'+compilerOf(r)));
  for(const a of activities){const log=logs.find(l=>key(l)===key(a)),d=days.find(d=>d.day===a.day&&compilerOf(d)===compilerOf(a));if(activitySite(a,log?log.site_id:d?.site_id,masters.locations)===selected.id)regKeys.add(a.day+'|'+compilerOf(a));}
  const registers=[...regKeys].sort().reverse().map(k=>{const [day,compiler]=k.split('|');return{day,compiler,rows:summary.rows.filter(r=>r.day===day&&compilerOf(r)===compiler)};});
  $('site-days').innerHTML=registers.length?'<ul class="selection-list">'+registers.map(d=>`<li><div><strong>${displayDate(d.day)} · ${esc(d.compiler)}</strong><p class="mini">${new Set(d.rows.map(r=>r.employee_id)).size} presenti · ${number(d.rows.reduce((s,r)=>s+r.hours,0))} h nel cantiere</p><p class="mini">${d.rows.map(r=>`<a href="${esc(profileURL(r.employee_id,r.day,compilerOf(r)))}">${esc(person(r.employee_id))} · ${number(r.hours)} h</a>`).join(' · ')||'Nessuna presenza con ore positive'}</p></div><a class="button secondary small" href="${esc(registerURL(d.day,d.compiler))}">Apri giornata</a></li>`).join('')+'</ul>':empty('Nessuna giornata collegata nel periodo.');
  const relevant=activities.filter(a=>{const log=logs.find(l=>key(l)===key(a)),d=days.find(d=>d.day===a.day&&compilerOf(d)===compilerOf(a));return activitySite(a,log?log.site_id:d?.site_id,masters.locations)===selected.id;}).sort((a,b)=>b.day.localeCompare(a.day)||person(a.employee_id).localeCompare(person(b.employee_id),'it')||a.start_minute-b.start_minute);
  $('site-activities').innerHTML=table('Attività del cantiere',['Giorno / operaio','Orario','Attività e note'],relevant.map(a=>`<tr><td><a href="${esc(profileURL(a.employee_id,a.day,compilerOf(a)))}">${esc(person(a.employee_id))}</a><br>${displayDate(a.day)}<br><span class="mini">${esc(compilerOf(a))}</span></td><td>${timeLabel(Number(a.start_minute))}–${timeLabel(Number(a.end_minute))}</td><td class="wrap">${esc(KINDS[a.kind]||a.kind)}${a.notes?'<p>'+esc(a.notes)+'</p>':''}${a.kind!=='pausa'&&!rows.some(r=>key(r)===key(a)&&isPresent(r))?'<span class="badge warn">Senza presenza positiva</span>':''}</td></tr>`));
  $('site-export').disabled=!summary.rows.length;
  renderMaterials();
 }
 async function load(id,resetForms=true){
  const from=$('site-from').value,to=$('site-to').value;
  if(!validDay(from)||!validDay(to)||from>to||(Date.parse(to)-Date.parse(from))/86400000>365){status('Seleziona un periodo valido di massimo 366 giorni.','error');if(period.length){$('site-from').value=period[0];$('site-to').value=period[1];}return false;}
  try{
   if(resetForms)await refreshMasters();const site=masters.sites.find(s=>s.id===id);if(!site)throw Object.assign(new Error('Cantiere non trovato. Apri l’elenco e seleziona una voce valida.'),{code:'P0001'});
   const results=await Promise.all(['days','attendance','worklogs','activities'].map(t=>allRows(client,t,q=>{let query=q.gte('day',from).lte('day',to).order('day').order('compiler');if(t!=='days')query=query.order('employee_id');if(t==='activities')query=query.order('position');return query;})));
   // Cambia scheda soltanto dopo che tutte le letture sono riuscite.
   const ids=masters.locations.filter(l=>l.site_id===id).map(l=>l.id);
   const balances=ids.length?await allRows(client,'balances',q=>q.in('location_id',ids).order('material_id').order('location_id')):[];
   selected=site;[data.days,data.attendance,data.logs,data.activities]=results;data.balances=balances;period=[from,to];
   title();if(resetForms){$('site-name').value=site.name;$('site-active').checked=site.active;masterDirty=false;resetLocationForm();dirty();}
   render();$('site-directory').hidden=true;$('site-detail').hidden=false;quickLink();history.replaceState(null,'',siteURL(id));return true;
  }catch(e){if(period.length){$('site-from').value=period[0];$('site-to').value=period[1];}throw e;}
 }
 async function updateLocation(params){
  const saved=check(await client.rpc('gest_save_site_location',params)),i=masters.locations.findIndex(l=>l.id===saved.id);
  if(i>=0)masters.locations[i]=saved;else masters.locations.push(saved);
  resetLocationForm();renderMaterials();
  try{data.balances=await readBalances();renderMaterials();status('Collegamento ubicazione salvato.','success');}catch{status('Collegamento salvato. Ricarica la scheda per aggiornare le giacenze.','warning');}
 }
 [$('site-from').value,$('site-to').value]=monthRange(today().slice(0,7));$('site-quick-day').value=today();directory();
 $('sites-search').addEventListener('input',directory);$('sites-state').addEventListener('change',directory);
 $('sites-list').addEventListener('click',e=>{const b=e.target.closest('[data-open-site]');if(b&&canDiscard())run(b,()=>load(b.dataset.openSite));});
 $('site-back').addEventListener('click',()=>{if(!canDiscard())return;masterDirty=false;locationDirty=false;dirty();selected=null;$('site-detail').hidden=true;$('site-directory').hidden=false;history.replaceState(null,'','cantieri.html');document.title='Cantieri e schede | Amministrazione Ponteggi';directory();$('sites-search').focus();});
 $('site-refresh').addEventListener('click',()=>{if(canDiscard())run($('site-refresh'),()=>load(selected.id));});
 $('site-period-form').addEventListener('submit',e=>{e.preventDefault();run(e.submitter,()=>load(selected.id,false));});
 $('site-compiler').addEventListener('change',()=>{if(selected)render();});
 for(const id of ['site-quick-day','site-quick-compiler'])$(id).addEventListener('change',quickLink);
 $('site-master-form').addEventListener('input',()=>{masterDirty=true;dirty();});
 $('site-master-form').addEventListener('submit',e=>{e.preventDefault();run(e.submitter,async()=>{
  const saved=check(await client.rpc('gest_save_master',{p_kind:'sites',p_id:selected.id,p_version:selected.version,p_data:{name:$('site-name').value.trim(),active:$('site-active').checked}}));
  masters.sites[masters.sites.findIndex(s=>s.id===saved.id)]=saved;selected=saved;masterDirty=false;dirty();title();$('site-name').value=saved.name;status('Dati del cantiere salvati.','success');
 });});
 $('site-location-select').addEventListener('change',locationFields);
 $('site-location-form').addEventListener('input',()=>{locationDirty=true;dirty();});
 $('site-location-form').addEventListener('submit',e=>{e.preventDefault();run(e.submitter,async()=>{
  const id=$('site-location-select').value,existing=masters.locations.find(l=>l.id===id);
  await updateLocation({p_id:existing?.id||newLocation,p_site:selected.id,p_version:existing?.version||0,p_name:existing?null:$('site-location-name').value.trim()});
 });});
 $('site-locations').addEventListener('click',e=>{const b=e.target.closest('[data-unlink]');if(!b||!canDiscard())return;const row=linked().find(l=>l.id===b.dataset.unlink);if(!row||!confirm('Scollegare questa ubicazione dal cantiere? I materiali restano nell’ubicazione. L’operazione è consentita solo se non ha giacenze né movimenti.'))return;run(b,()=>updateLocation({p_id:row.id,p_site:null,p_version:row.version,p_name:null}));});
 $('site-export').addEventListener('click',()=>{
  const entries=siteSummary(allocation.entries,selected.id).rows;
  download('cantiere-'+selected.id+'-'+period[0]+'-'+period[1]+'.csv',csv([['Cantiere','Dal','Al','Data','Compilatore','Operaio','Ore nel cantiere','Ore totali registro','Attribuzione'],...entries.map(r=>[selected.name,...period,r.day,compilerOf(r),person(r.employee_id),String(r.hours).replace('.',','),String(r.register_hours).replace('.',','),r.source])]),'text/csv;charset=utf-8');
 });
 const requested=new URLSearchParams(location.search).get('cantiere');if(requested)try{await load(requested);}catch(e){status(e.message||'Impossibile aprire la scheda.','error');}
}
