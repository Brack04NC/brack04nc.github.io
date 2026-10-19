import {today,validDay,escapeHTML as esc,number,displayDate,timestamp,unitLabel,csv,download} from './helpers.js?v=ba2cf907944e';

export async function initDepot(ctx){
  const {$,client,check,allRows,masters,status,run,setDirty,refreshMasters}=ctx;
  let balances=[],history=[],historyOffset=0,historyRange=[],pending=null,reversed=new Set();
  const material=id=>masters.materials.find(x=>x.id===id);
  const locationName=id=>id?(masters.locations.find(x=>x.id===id)?.name||'Ubicazione archiviata'):'Esterno';
  const quantity=(m,l)=>Number(balances.find(b=>b.material_id===m&&b.location_id===l)?.quantity||0);
  function options(rows,blank='Seleziona…'){
    return `<option value="">${blank}</option>`+rows.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}${x.code?' · '+esc(x.code):''}${x.plate?' · '+esc(x.plate):''}</option>`).join('');
  }
  function fillOptions(){
    const values=Object.fromEntries(['movement-material','movement-source','movement-destination','stock-location'].map(id=>[id,$(id).value]));
    $('movement-material').innerHTML=options(masters.materials.filter(x=>x.active));
    const active=masters.locations.filter(x=>x.active);
    $('movement-source').innerHTML=options(active);$('movement-destination').innerHTML=options(active);
    $('stock-location').innerHTML=options(masters.locations,'Tutte le ubicazioni');
    for(const [id,v] of Object.entries(values))if(Array.from($(id).options).some(o=>o.value===v))$(id).value=v;
  }
  function available(){
    const m=material($('movement-material').value);
    $('quantity-unit').textContent=m?'('+unitLabel(m.unit)+')':'';
    $('movement-quantity').step=m?.unit==='pz'?'1':'0.001';$('movement-quantity').min=m?.unit==='pz'?'1':'0.001';
    $('available-stock').textContent=$('movement-type').value!=='load'&&m&&$('movement-source').value?`Disponibili nell’origine: ${number(quantity(m.id,$('movement-source').value))} ${unitLabel(m.unit)}. La disponibilità viene ricontrollata al salvataggio.`:'Indica il motivo del carico, dello scarico o del trasferimento.';
  }
  function typeChanged(){
    const t=$('movement-type').value;
    $('source-field').hidden=t==='load';$('destination-field').hidden=t==='unload';
    $('movement-source').required=t!=='load';$('movement-destination').required=t!=='unload';available();
  }
  function renderStock(){
    const search=$('stock-search').value.trim().toLocaleLowerCase('it'),loc=$('stock-location').value;
    const list=masters.materials.filter(m=>(m.active||balances.some(b=>b.material_id===m.id&&Number(b.quantity)>0))&&`${m.name} ${m.code}`.toLocaleLowerCase('it').includes(search));
    $('stock-list').innerHTML=list.length?list.map(m=>{
      const rows=masters.locations.filter(l=>(!loc||l.id===loc)&&(l.active||quantity(m.id,l.id)>0));
      const total=rows.reduce((s,l)=>s+quantity(m.id,l.id),0);
      return `<article class="stock-card"><header><div><h3>${esc(m.name)}</h3><span class="mini">${esc(m.code)} · ${esc(unitLabel(m.unit))}</span></div><strong>${number(total)} ${esc(unitLabel(m.unit))}</strong></header><ul>${rows.map(l=>`<li><span>${esc(l.name)}${l.plate?' · '+esc(l.plate):''}<span class="mini"> (${esc(l.kind)})</span></span><strong>${number(quantity(m.id,l.id))}</strong></li>`).join('')}</ul></article>`;
    }).join(''):'<div class="empty">Nessun materiale trovato. <a href="anagrafiche.html">Aggiungi i materiali e i camion</a> nelle anagrafiche.</div>';
  }
  async function refresh(){
    await refreshMasters();
    balances=await allRows(client,'balances',q=>q.order('material_id').order('location_id'));
    fillOptions();renderStock();available();
  }
  function renderHistory(){
    $('movement-history').innerHTML=history.length?`<div class="table-scroll" tabindex="0" role="region" aria-label="Storico movimenti"><table><thead><tr><th>Data / materiale</th><th>Da → A</th><th class="numeric">Quantità</th><th>Causale / autore</th><th>Correzione</th></tr></thead><tbody>${history.map(m=>`<tr><td class="wrap"><strong>${displayDate(m.movement_date)}</strong><br>${esc(material(m.material_id)?.name||'Materiale')}<br><span class="mini">ID ${esc(m.id.slice(0,8))}</span></td><td class="wrap">${esc(locationName(m.source_id))}<br>→ ${esc(locationName(m.destination_id))}</td><td class="numeric">${number(m.quantity)} ${esc(unitLabel(material(m.material_id)?.unit||''))}</td><td class="wrap">${esc(m.reason)}<br><span class="mini">${timestamp(m.created_at)}<br>Autore ${esc(m.created_by.slice(0,8))}</span></td><td>${m.reverse_of?'<span class="badge">Storno</span>':reversed.has(m.id)?'<span class="badge">Stornato</span>':`<button type="button" class="secondary small" data-reverse="${esc(m.id)}" ${pending?'disabled':''}>Storna</button>`}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Nessun movimento nel periodo selezionato.</div>';
  }
  async function loadHistory(reset=true){
    const from=reset?$('history-from').value:historyRange[0],to=reset?$('history-to').value:historyRange[1];
    if(!validDay(from)||!validDay(to)||from>to){status('Seleziona un intervallo di date valido.','error');return;}
    const offset=reset?0:historyOffset;
    const rows=await client.from('gest_movements').select('*').gte('movement_date',from).lte('movement_date',to).order('movement_date',{ascending:false}).order('created_at',{ascending:false}).order('id').range(offset,offset+49).then(check).catch(e=>{
      if(historyRange.length){$('history-from').value=historyRange[0];$('history-to').value=historyRange[1];}throw e;
    });
    // Lo storno può appartenere a un altro mese o a una pagina successiva.
    // Cerca le inversioni dei soli movimenti appena letti, senza filtro data.
    const ids=rows.filter(x=>!x.reverse_of).map(x=>x.id);
    const reversals=ids.length?await client.from('gest_movements').select('reverse_of').in('reverse_of',ids).then(check).catch(e=>{
      if(historyRange.length){$('history-from').value=historyRange[0];$('history-to').value=historyRange[1];}throw e;
    }):[];
    const nextReversed=reset?new Set():new Set(reversed);
    for(const row of reversals)nextReversed.add(row.reverse_of);
    reversed=nextReversed;
    history=reset?rows:[...history,...rows];historyRange=[from,to];historyOffset=offset+rows.length;
    $('more-movements').hidden=rows.length<50;renderHistory();
  }
  function freezePending(){
    for(const field of $('movement-form').querySelectorAll('input,select'))field.disabled=!!pending;
    $('save-movement').textContent=pending?'Riprova lo stesso movimento':'Registra movimento';
    $('movement-pending').hidden=!pending;
    if(pending)$('movement-pending').textContent=`Esito non confermato per il movimento ${pending.p_id}. Riprova: verrà riutilizzato lo stesso identificativo, senza duplicare il movimento. Non chiudere la pagina prima della verifica.`;
    renderHistory();
  }
  async function sendMovement(params){
    pending=params;setDirty();
    try{
      check(await client.rpc('gest_move_stock',pending));
    }catch(e){
      // Un errore PostgreSQL conferma il rollback. Un errore di rete può aver
      // perso la risposta dopo il commit: conservare l'identificativo è essenziale.
      if(e.code)pending=null;
      freezePending();throw e;
    }
    pending=null;freezePending();setDirty(false);
    $('movement-quantity').value='';$('movement-reason').value='';
    status('Movimento registrato.','success');
    try{await refresh();await loadHistory(true);}catch{status('Movimento salvato. L’aggiornamento delle giacenze non è riuscito: premi “Aggiorna giacenze”.','warning');}
  }
  $('movement-day').value=today();$('history-from').value=today().slice(0,7)+'-01';$('history-to').value=today();
  await refresh();typeChanged();await loadHistory();
  $('movement-type').addEventListener('change',typeChanged);
  for(const id of ['movement-material','movement-source'])$(id).addEventListener('change',available);
  $('movement-form').addEventListener('input',()=>setDirty());
  $('movement-form').addEventListener('submit',e=>{
    e.preventDefault();run(e.submitter,async()=>{
      if(pending){await sendMovement(pending);return;}
      const type=$('movement-type').value;
      const params={p_id:crypto.randomUUID(),p_material:$('movement-material').value,p_source:type==='load'?null:$('movement-source').value,p_destination:type==='unload'?null:$('movement-destination').value,p_quantity:Number($('movement-quantity').value),p_date:$('movement-day').value,p_reason:$('movement-reason').value.trim(),p_reverse_of:null};
      if(params.p_source&&params.p_source===params.p_destination){status('Origine e destinazione devono essere diverse.','error');return;}
      await sendMovement(params);
    });
  });
  $('refresh-stock').addEventListener('click',()=>run($('refresh-stock'),async()=>{await refresh();status('Giacenze aggiornate.','success');}));
  $('stock-search').addEventListener('input',renderStock);$('stock-location').addEventListener('change',renderStock);
  $('history-form').addEventListener('submit',e=>{e.preventDefault();run(e.submitter,()=>loadHistory(true));});
  $('more-movements').addEventListener('click',()=>run($('more-movements'),()=>loadHistory(false)));
  $('movement-history').addEventListener('click',e=>{
    const btn=e.target.closest('[data-reverse]');if(!btn||pending||!ctx.canDiscard())return;
    const m=history.find(x=>x.id===btn.dataset.reverse);
    const reason=window.prompt(`Storno di ${number(m.quantity)} ${unitLabel(material(m.material_id).unit)} di ${material(m.material_id).name}. Verrà registrato il trasferimento inverso. Indica il motivo (almeno 3 caratteri):`);
    if(reason===null)return;
    if(reason.trim().length<3){status('Indica il motivo dello storno (almeno 3 caratteri).','error');return;}
    run(btn,()=>sendMovement({p_id:crypto.randomUUID(),p_material:m.material_id,p_source:m.destination_id,p_destination:m.source_id,p_quantity:Number(m.quantity),p_date:today(),p_reason:reason.trim(),p_reverse_of:m.id}));
  });
  $('export-stock').addEventListener('click',()=>{
    const data=[['Codice','Materiale','Unità','Ubicazione','Tipo','Targa','Quantità']];
    for(const m of masters.materials)for(const l of masters.locations)if(m.active&&l.active||quantity(m.id,l.id)>0)data.push([m.code,m.name,unitLabel(m.unit),l.name,l.kind,l.plate,String(quantity(m.id,l.id)).replace('.',',')]);
    download(`giacenze-${today()}.csv`,csv(data),'text/csv;charset=utf-8');status('Esportate tutte le giacenze caricate, senza applicare i filtri di visualizzazione.','success');
  });
  $('export-movements').addEventListener('click',()=>run($('export-movements'),async()=>{
    const [from,to]=historyRange;
    const rows=await allRows(client,'movements',q=>q.gte('movement_date',from).lte('movement_date',to).order('movement_date').order('created_at').order('id'));
    download(`movimenti-${from}-${to}.csv`,csv([['ID','Data','Codice','Materiale','Da','A','Quantità','Unità','Causale','Registrato il','Autore UID','Storno di'],...rows.map(m=>[m.id,m.movement_date,material(m.material_id)?.code,material(m.material_id)?.name,locationName(m.source_id),locationName(m.destination_id),String(m.quantity).replace('.',','),unitLabel(material(m.material_id)?.unit),m.reason,m.created_at,m.created_by,m.reverse_of])]),'text/csv;charset=utf-8');
    status('Esportati tutti i movimenti del periodo visualizzato.','success');
  }));
}
