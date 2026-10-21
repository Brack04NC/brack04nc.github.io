import {escapeHTML as esc,unitLabel} from './helpers.js?v=f8ee9f823b48';

export async function initMasters(ctx){
  const {$,client,check,masters,status,run,setDirty,canDiscard,refreshMasters}=ctx;
  let kind=['employees','sites','materials','locations'].includes(new URLSearchParams(location.search).get('tipo'))?new URLSearchParams(location.search).get('tipo'):'employees',editing=null,newId=crypto.randomUUID(),seed=null;
  const labels={employees:'personale',sites:'cantiere',materials:'materiale',locations:'ubicazione'};
  function render(){
    const search=$('master-search').value.toLocaleLowerCase('it');
    const rows=masters[kind].filter(x=>`${x.name} ${x.code||''} ${x.plate||''}`.toLocaleLowerCase('it').includes(search));
    $('master-list').innerHTML=rows.length?`<ul class="selection-list">${rows.map(x=>`<li><div><strong>${esc(x.name)}</strong><p class="mini">${[x.code,x.plate,x.unit&&unitLabel(x.unit),x.kind,!x.active&&'Archiviato'].filter(Boolean).map(esc).join(' · ')}</p>${kind==='sites'?`<a class="person-profile-link" href="cantieri.html?cantiere=${encodeURIComponent(x.id)}">Scheda cantiere</a>`:''}${kind==='locations'&&x.site_id?`<a class="person-profile-link" href="cantieri.html?cantiere=${encodeURIComponent(x.site_id)}">Cantiere collegato</a>`:''}${kind==='employees'?`<a class="person-profile-link" href="operaio.html?operaio=${encodeURIComponent(x.id)}">Scheda operaio e calendario</a>`:''}</div><button type="button" class="secondary small" data-edit="${esc(x.id)}" aria-label="Modifica ${esc(x.name)}">Modifica</button></li>`).join('')}</ul>`:'<div class="empty">Nessuna voce trovata. Aggiungila con il modulo qui sotto.</div>';
  }
  function form(row=null){
    editing=row;newId=crypto.randomUUID();$('master-form').reset();
    $('master-heading').textContent=(row?'Modifica ':'Aggiungi ')+labels[kind];
    $('master-code-field').hidden=!['employees','materials'].includes(kind);$('master-code').required=kind==='materials';
    $('master-unit-field').hidden=kind!=='materials';
    $('master-location-field').hidden=kind!=='locations';$('master-plate-field').hidden=kind!=='locations';
    $('master-name').maxLength=kind==='sites'?180:120;
    $('master-name').value=row?.name||'';$('master-code').value=row?.code||'';$('master-unit').value=row?.unit||'pz';
    $('master-location-kind').value=row?.kind||'magazzino';$('master-plate').value=row?.plate||'';$('master-active').checked=row?.active??true;
    setDirty(false);
  }
  $('master-kind').value=kind;render();form();
  $('master-kind').addEventListener('change',()=>{if(!canDiscard()){$('master-kind').value=kind;return;}kind=$('master-kind').value;$('master-search').value='';form();render();});
  $('master-search').addEventListener('input',render);
  $('master-list').addEventListener('click',e=>{const btn=e.target.closest('[data-edit]');if(!btn||!canDiscard())return;form(masters[kind].find(x=>x.id===btn.dataset.edit));$('master-name').focus();});
  $('master-form').addEventListener('input',()=>setDirty());
  $('cancel-master').addEventListener('click',()=>{if(canDiscard())form();});
  $('master-form').addEventListener('submit',e=>{
    e.preventDefault();run(e.submitter,async()=>{
      const data={name:$('master-name').value.trim(),code:$('master-code').value.trim(),unit:$('master-unit').value,kind:$('master-location-kind').value,plate:$('master-plate').value.trim(),active:$('master-active').checked};
      const saved=check(await client.rpc('gest_save_master',{p_kind:kind,p_id:editing?.id||newId,p_version:editing?.version||0,p_data:data}));
      // Aggiorna subito l'identità/revisione anche se il successivo refresh fallisce.
      editing=saved;setDirty(false);
      const i=masters[kind].findIndex(x=>x.id===saved.id);if(i>=0)masters[kind][i]=saved;else masters[kind].push(saved);
      form();render();status('Anagrafica salvata.','success');
    });
  });
  $('seed-file').addEventListener('change',()=>run(null,async()=>{
    seed=null;$('import-seed').disabled=true;$('import-preview').replaceChildren();
    const file=$('seed-file').files[0];if(!file)return;
    if(file.size>500000){status('File troppo grande: il limite è 500 KB.','error');return;}
    let value;try{value=JSON.parse(await file.text());}catch{status('Il file non contiene JSON valido.','error');return;}
    if(value.format!=='ponteggi-anagrafiche-v1'||!Array.isArray(value.employees)||!Array.isArray(value.sites)||value.employees.length>500||value.sites.length>1000||[...value.employees,...value.sites].some(x=>typeof x.name!=='string'||x.name.trim().length<2||x.name.length>120)){
      status('Formato del file non riconosciuto. Usa dati-iniziali-privati.json incluso nello ZIP.','error');return;
    }
    seed={employees:value.employees.map(x=>({name:x.name.trim()})),sites:value.sites.map(x=>({name:x.name.trim()}))};
    $('import-preview').innerHTML=`<p><strong>${seed.employees.length} persone e ${seed.sites.length} cantieri</strong>. Le voci con lo stesso nome già presenti saranno saltate, comprese quelle archiviate.</p><ul class="import-preview">${[...seed.employees.map(x=>'Persona: '+x.name),...seed.sites.map(x=>'Cantiere: '+x.name)].map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
    $('import-seed').disabled=false;
  }));
  $('import-seed').addEventListener('click',()=>run($('import-seed'),async()=>{
    if(!seed||!canDiscard())return;
    await refreshMasters();let count=0;
    for(const table of ['employees','sites'])for(const row of seed[table]){
      if(masters[table].some(x=>x.name.toLocaleLowerCase('it')===row.name.toLocaleLowerCase('it')))continue;
      const saved=check(await client.rpc('gest_save_master',{p_kind:table,p_id:crypto.randomUUID(),p_version:0,p_data:{name:row.name,active:true}}));
      masters[table].push(saved);count++;
    }
    seed=null;$('seed-file').value='';$('import-preview').replaceChildren();form();render();
    status(`${count} voci importate. Le presenze storiche non sono incluse in questa importazione.`,'success');
    // run riabilita il bottone dopo la Promise: senza seed il click rimane innocuo.
  }));
}
