import {today,validDay,escapeHTML as esc,number,displayDate,timestamp,monthRange,summarize,csv,download,validateEntries} from './helpers.js?v=f8ee9f823b48';
import {siteNames,profileURL} from './registri.js?v=f8ee9f823b48';
const COMPILERS=['Tecnico 1','Tecnico 2','Ufficio'];
const compilerOf=row=>row.compiler||'Ufficio';
const sameRegister=(a,b)=>a.day===b.day&&compilerOf(a)===compilerOf(b);

export async function initAttendance(ctx) {
  const {$,client,check,allRows,masters,status,run,setDirty,canDiscard,refreshMasters}=ctx;
  const requestedSite=new URLSearchParams(location.search).get('cantiere');
  function siteLink(){const id=$('attendance-site').value;$('attendance-site-profile').hidden=!id;$('attendance-site-profile').href='cantieri.html?cantiere='+encodeURIComponent(id);}
  let loadedDay='',loadedCompiler='Ufficio',revision=0,entries=[],loading=false,siteRows=[];
  function totals(){
    const hours=entries.reduce((s,x)=>s+(Number(x.hours)||0),0);
    $('attendance-totals').textContent=`${entries.filter(x=>x.present&&Number(x.hours)>0).length} presenti · ${entries.filter(x=>!x.present).length} assenti · ${number(hours)} ore · ${number(hours/8)} giorni equivalenti`;
  }
  function changed(){setDirty();$('save-state').textContent='Modifiche da salvare.';totals();}
  function filterSites(){
    const selected=$('attendance-site').value,term=$('site-search').value.trim().toLocaleLowerCase('it-IT');
    const matches=siteRows.filter(s=>s.name.toLocaleLowerCase('it-IT').includes(term));
    const visible=siteRows.filter(s=>matches.includes(s)||s.id===selected);
    $('attendance-site').innerHTML='<option value="">Non specificato</option>'+visible.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}${s.active?'':' (archiviato)'}${!matches.includes(s)?' (selezionato)':''}</option>`).join('');
    $('attendance-site').value=selected;
    siteLink();$('site-results-count').textContent=`${matches.length} di ${siteRows.length} cantieri`;
  }
  function render(){
    $('attendance-list').innerHTML=entries.length?entries.map(e=>{
      const p=masters.employees.find(x=>x.id===e.employee_id);
      return `<div class="person-row ${e.present?'present':''}" data-employee="${esc(p.id)}"><div><label class="person-name"><input type="checkbox" data-present ${e.present?'checked':''}><span>${esc(p.name)}${p.active?'':' <span class="mini">(archiviato)</span>'}${p.code?`<br><span class="mini">${esc(p.code)}</span>`:''}</span></label><a class="person-profile-link" href="operaio.html?operaio=${encodeURIComponent(p.id)}&amp;giorno=${loadedDay}&amp;compilatore=${encodeURIComponent(loadedCompiler)}">Scheda e attività</a></div><div><label class="hours-label" for="hours-${esc(p.id)}">Ore lavorate</label><input id="hours-${esc(p.id)}" data-hours type="number" value="${e.hours}" min="0" max="24" step="0.25" inputmode="decimal" aria-label="Ore di ${esc(p.name)}" ${e.present?'required':'disabled'}></div><div class="quick-hours"><button type="button" data-hours-preset="4" class="secondary small" aria-label="Imposta mezza giornata, 4 ore, per ${esc(p.name)}">½ · 4 h</button><button type="button" data-hours-preset="8" class="secondary small" aria-label="Imposta una giornata, 8 ore, per ${esc(p.name)}">1 · 8 h</button></div></div>`;
    }).join(''):'<div class="empty">Nessun nominativo attivo. <a href="anagrafiche.html">Aggiungi il personale</a> prima di compilare la giornata.</div>';
    $('save-attendance').disabled=!entries.length||loading;totals();
  }
  async function load(day,compiler=loadedCompiler){
    if(!validDay(day)||!COMPILERS.includes(compiler))throw new Error('Data o compilatore non valido');
    loading=true;$('attendance-day').disabled=true;$('attendance-compiler').disabled=true;$('save-attendance').disabled=true;
    try{
      await refreshMasters();
      const [record,allEntries]=await Promise.all([
        client.from('gest_days').select('*').eq('day',day).eq('compiler',compiler).maybeSingle().then(check),
        allRows(client,'attendance',q=>q.eq('day',day).order('compiler').order('employee_id'))
      ]);
      const rows=allEntries.filter(x=>compilerOf(x)===compiler),others=allEntries.filter(x=>compilerOf(x)!==compiler&&x.present);
      entries=masters.employees.filter(p=>p.active||rows.some(x=>x.employee_id===p.id)).map(p=>{
        const old=rows.find(x=>x.employee_id===p.id);
        return {employee_id:p.id,present:old?.present||false,hours:Number(old?.hours||0)};
      });
      loadedDay=day;loadedCompiler=compiler;revision=record?.revision||0;
      sessionStorage.setItem('ponteggi-last-compiler',compiler);
      $('attendance-day').value=day;$('attendance-compiler').value=compiler;
      siteRows=masters.sites.filter(s=>s.active||s.id===record?.site_id);
      $('site-search').value='';
      $('attendance-site').innerHTML='<option value="">Non specificato</option>'+siteRows.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}${s.active?'':' (archiviato)'}</option>`).join('');
      $('attendance-site').value=record?.site_id||(!record&&siteRows.some(s=>s.id===requestedSite)?requestedSite:'');filterSites();
      const weather=record?.weather||'';
      if(!Array.from($('weather').options).some(o=>o.value===weather)){const o=document.createElement('option');o.value=weather;o.textContent=weather;$('weather').append(o);}
      $('weather').value=weather;$('day-note').value=record?.notes||'';
      $('compiler-warning').hidden=!others.length;
      $('compiler-warning').textContent=others.length?'Negli altri registri della stessa data sono già presenti ore per: '+others.map(r=>(masters.employees.find(e=>e.id===r.employee_id)?.name||'Persona archiviata')+' · '+compilerOf(r)+' · '+number(r.hours)+' h').join('; ')+'. Controlla che siano ore distinte: il riepilogo somma le ore dei registri.':'';
      $('day-revision').textContent=revision?`Salvata · revisione ${revision}`:'Da compilare';
      $('day-updated').textContent=record?`Ultimo salvataggio: ${timestamp(record.updated_at)} · ${compiler} · autore ${record.updated_by.slice(0,8)}`:'';
      $('save-state').textContent=revision?'Registro caricato dal database.':'Registro nuovo: nessuna presenza salvata.';
      setDirty(false);render();
    }finally{loading=false;$('attendance-day').disabled=false;$('attendance-compiler').disabled=false;$('save-attendance').disabled=!entries.length;$('attendance-day').value=loadedDay||day;$('attendance-compiler').value=loadedCompiler;}
  }
  const query=new URLSearchParams(location.search),requested=query.get('giorno');
  const requestedCompiler=query.get('compilatore')||sessionStorage.getItem('ponteggi-last-compiler')||'Ufficio';
  await load(requested&&validDay(requested)?requested:today(),COMPILERS.includes(requestedCompiler)?requestedCompiler:'Ufficio');
  function changeRegister(){
    const day=$('attendance-day').value,compiler=$('attendance-compiler').value;
    if(loading||!validDay(day)||!canDiscard()){$('attendance-day').value=loadedDay;$('attendance-compiler').value=loadedCompiler;return;}
    run(null,()=>load(day,compiler));
  }
  $('attendance-day').addEventListener('change',changeRegister);
  $('attendance-compiler').addEventListener('change',changeRegister);
  $('site-search').addEventListener('input',filterSites);
  $('attendance-site').addEventListener('change',siteLink);
  for(const id of ['attendance-site','weather','day-note'])$(id).addEventListener('input',changed);
  $('attendance-list').addEventListener('change',e=>{
    const row=e.target.closest('[data-employee]');if(!row)return;
    const entry=entries.find(x=>x.employee_id===row.dataset.employee);
    if(e.target.matches('[data-present]')){
      entry.present=e.target.checked;entry.hours=entry.present?8:0;
      row.classList.toggle('present',entry.present);
      const hours=row.querySelector('[data-hours]');hours.disabled=!entry.present;hours.required=entry.present;hours.value=entry.hours;
    }
    changed();
  });
  $('attendance-list').addEventListener('input',e=>{
    if(!e.target.matches('[data-hours]'))return;
    const row=e.target.closest('[data-employee]'),entry=entries.find(x=>x.employee_id===row.dataset.employee);entry.hours=e.target.value===''?NaN:Number(e.target.value);if(Number.isFinite(entry.hours)){entry.present=entry.hours>0;row.querySelector('[data-present]').checked=entry.present;row.classList.toggle('present',entry.present);}changed();
  });
  $('attendance-list').addEventListener('click',e=>{
    const button=e.target.closest('[data-hours-preset]');if(!button)return;
    const entry=entries.find(x=>x.employee_id===button.closest('[data-employee]').dataset.employee);
    entry.present=true;entry.hours=Number(button.dataset.hoursPreset);render();changed();
  });
  $('all-present').addEventListener('click',()=>{for(const e of entries){e.present=true;e.hours=8;}render();changed();});
  $('all-absent').addEventListener('click',()=>{for(const e of entries){e.present=false;e.hours=0;}render();changed();});
  $('reload-day').addEventListener('click',()=>{if(canDiscard())run($('reload-day'),()=>load(loadedDay));});
  $('attendance-form').addEventListener('submit',event=>{
    event.preventDefault();if(loading)return;
    run(event.submitter,async()=>{
      try{validateEntries(entries);}catch(e){status(e.message,'error');return;}
      const result=check(await client.rpc('gest_save_day',{p_day:loadedDay,p_compiler:loadedCompiler,p_site:$('attendance-site').value||null,p_weather:$('weather').value,p_notes:$('day-note').value,p_entries:entries,p_revision:revision}));
      revision=result.revision;setDirty(false);
      $('day-revision').textContent=`Salvata · revisione ${revision}`;
      $('day-updated').textContent=`Ultimo salvataggio: ${timestamp(result.updated_at)} · ${loadedCompiler} · autore ${result.updated_by.slice(0,8)}`;
      $('save-state').textContent='Tutte le modifiche sono salvate.';
      status('Presenze del '+displayDate(loadedDay)+' · '+loadedCompiler+' salvate.','success');
    });
  });
}

export async function initArchive(ctx){
  const {$,client,check,allRows,masters,status,run}=ctx;
  let allEntries=[],allDays=[],rows=[],days=[],summary=[],worklogs=[],activities=[],month='';
  $('archive-month').value=today().slice(0,7);
  const site=id=>masters.sites.find(s=>s.id===id)?.name||'—';
  function render(){
    const compiler=$('archive-compiler').value,term=$('archive-search').value.trim().toLocaleLowerCase('it-IT');
    days=allDays.filter(d=>(!compiler||compilerOf(d)===compiler)&&[d.day,displayDate(d.day),site(d.site_id),d.weather,d.notes,compilerOf(d)].join(' ').toLocaleLowerCase('it-IT').includes(term));
    rows=allEntries.filter(r=>days.some(d=>sameRegister(d,r)));
    summary=summarize(rows,masters.employees.filter(e=>e.active||rows.some(r=>r.employee_id===e.id)));
    const hours=summary.reduce((s,e)=>s+e.hours,0),present=summary.reduce((s,e)=>s+e.days,0);
    $('archive-stats').innerHTML=[['Registri visualizzati',days.length],['Presenze complessive',present],['Ore visualizzate',number(hours)]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${v}</strong></div>`).join('');
    $('month-summary').innerHTML=summary.length?`<div class="table-scroll" tabindex="0" role="region" aria-label="Riepilogo mensile"><table><thead><tr><th>Persona</th><th class="numeric">Presenze</th><th class="numeric">Ore</th><th class="numeric">Giorni eq.</th><th>Date e ore</th></tr></thead><tbody>${summary.map(e=>`<tr><td><a href="${esc(profileURL(e.id,month+'-01',compiler||'Ufficio'))}">${esc(e.name)}</a>${e.code?`<br><span class="mini">${esc(e.code)}</span>`:''}</td><td class="numeric">${e.days}</td><td class="numeric">${number(e.hours)}</td><td class="numeric">${number(e.equivalent)}</td><td class="summary-dates">${rows.filter(r=>r.employee_id===e.id&&r.present&&Number(r.hours)>0).map(r=>esc(displayDate(r.day)+' · '+compilerOf(r)+' · '+number(r.hours)+' h')).join('<br>')||'—'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Nessun nominativo disponibile.</div>';
    $('archive-days').innerHTML=days.length?`<ul class="selection-list">${days.map(d=>{const records=rows.filter(r=>sameRegister(r,d));return `<li><div><strong>${displayDate(d.day)} · ${esc(compilerOf(d))}</strong><p class="mini">${esc(site(d.site_id))} · ${esc(d.weather||'Meteo non indicato')} · ${records.filter(r=>r.present&&Number(r.hours)>0).length} presenti · ${number(records.reduce((s,r)=>s+Number(r.hours),0))} ore</p><p class="mini">${esc(d.notes||'Nessuna nota')}</p></div><a class="button secondary small" href="presenze.html?giorno=${d.day}&amp;compilatore=${encodeURIComponent(compilerOf(d))}">Apri</a></li>`;}).join('')}</ul>`:'<div class="empty">Nessun registro corrispondente ai filtri.</div>';
    $('export-attendance').disabled=!days.length;$('export-days').disabled=!days.length;
  }
  async function load(){
    const chosen=$('archive-month').value,[start,end]=monthRange(chosen);
    const result=await Promise.all([
      allRows(client,'days',q=>q.gte('day',start).lte('day',end).order('day',{ascending:false}).order('compiler')),
      allRows(client,'attendance',q=>q.gte('day',start).lte('day',end).order('day').order('compiler').order('employee_id')),
      allRows(client,'worklogs',q=>q.gte('day',start).lte('day',end).order('day').order('compiler').order('employee_id')),
      allRows(client,'activities',q=>q.gte('day',start).lte('day',end).order('day').order('compiler').order('employee_id'))
    ]).catch(e=>{$('archive-month').value=month||chosen;throw e;});
    [allDays,allEntries,worklogs,activities]=result;month=chosen;render();
  }
  await load();
  $('archive-compiler').addEventListener('change',render);$('archive-search').addEventListener('input',render);
  $('month-form').addEventListener('submit',e=>{e.preventDefault();run(e.submitter,async()=>{await load();status('Riepilogo aggiornato.','success');});});
  $('export-attendance').addEventListener('click',()=>download(`presenze-riepilogo-${month}.csv`,csv([['Mese','Filtro compilatore','Codice','Nominativo','Presenze','Ore','Giorni equivalenti (ore/8)','Date e ore'],...summary.map(e=>[month,$('archive-compiler').value||'Tutti',e.code,e.name,e.days,String(e.hours).replace('.',','),String(e.equivalent).replace('.',','),rows.filter(r=>r.employee_id===e.id&&r.present&&Number(r.hours)>0).map(r=>r.day+' '+compilerOf(r)+' '+number(r.hours)+' h').join(' | ')])]),'text/csv;charset=utf-8'));
  $('export-days').addEventListener('click',()=>download(`presenze-giornaliere-${month}.csv`,csv([['Data','Compilatore','Codice','Nominativo','Presente','Ore','Cantiere','Meteo','Note'],...rows.map(r=>{const e=masters.employees.find(e=>e.id===r.employee_id),d=days.find(d=>sameRegister(d,r));return[r.day,compilerOf(r),e?.code,e?.name,r.present&&Number(r.hours)>0?'Sì':'No',String(r.hours).replace('.',','),siteNames(r.employee_id,r.day,[r],days,worklogs,activities,masters),d?.weather,d?.notes];})]),'text/csv;charset=utf-8'));
}
