import {escapeHTML as esc,number,unitLabel,csv,download,today} from './helpers.js?v=f8ee9f823b48';

export async function initMaterials(ctx){
 const {$,client,check,allRows,masters,run,status,setDirty,canDiscard,refreshMasters}=ctx;
 let balances=[],editing=null,newId=crypto.randomUUID(),visible=[];
 const quantity=(id,kind)=>balances.filter(b=>b.material_id===id&&(!kind||masters.locations.find(l=>l.id===b.location_id)?.kind===kind)).reduce((s,b)=>s+Number(b.quantity),0);
 function form(row=null){editing=row;newId=crypto.randomUUID();$('catalog-heading').textContent=row?'Modifica materiale':'Nuovo materiale';$('catalog-name').value=row?.name||'';$('catalog-code').value=row?.code||'';$('catalog-edit-unit').value=row?.unit||'pz';$('catalog-active').checked=row?.active??true;setDirty(false);}
 function render(){
  const term=$('catalog-search').value.trim().toLocaleLowerCase('it'),state=$('catalog-state').value,unit=$('catalog-unit').value;
  visible=masters.materials.filter(m=>(state==='all'||m.active===(state==='active'))&&(!unit||m.unit===unit)&&`${m.name} ${m.code}`.toLocaleLowerCase('it').includes(term));
  $('catalog-count').textContent=`${visible.length} materiali visualizzati · ${masters.materials.filter(m=>m.active).length} attivi nel catalogo`;
  $('catalog-list').innerHTML=visible.length?visible.map(m=>{
   const u=esc(unitLabel(m.unit)),rows=balances.filter(b=>b.material_id===m.id&&Number(b.quantity)>0);
   return `<article class="stock-card"><header><div><h3>${esc(m.name)}</h3><p class="mini">${esc(m.code)} · ${u} · ${m.active?'Attivo':'Archiviato'}</p></div><button type="button" class="secondary small" data-material="${esc(m.id)}" aria-label="Modifica ${esc(m.name)}">Modifica</button></header><ul><li><span>In magazzino</span><strong>${number(quantity(m.id,'magazzino'))} ${u}</strong></li><li><span>Sui camion</span><strong>${number(quantity(m.id,'camion'))} ${u}</strong></li><li><span>Nei cantieri</span><strong>${number(quantity(m.id,'cantiere'))} ${u}</strong></li><li><span>Totale materiale</span><strong>${number(quantity(m.id))} ${u}</strong></li></ul><details class="spaced"><summary>Dettaglio per ubicazione</summary>${rows.length?'<ul>'+rows.map(b=>{const l=masters.locations.find(x=>x.id===b.location_id);return `<li><span>${esc(l?.name||'Ubicazione')}${l?.plate?' · '+esc(l.plate):''}</span><strong>${number(b.quantity)} ${u}</strong></li>`;}).join('')+'</ul>':'<p class="hint">Nessuna giacenza. Registra un carico nel deposito.</p>'}</details><div class="actions"><a class="button secondary small" href="deposito.html?materiale=${encodeURIComponent(m.id)}">Movimenta materiale</a></div></article>`;
  }).join(''):'<div class="empty">Nessun materiale corrispondente. Aggiungi un materiale per iniziare; le quantità si registrano nel deposito.</div>';
 }
 async function refresh(){await refreshMasters();balances=await allRows(client,'balances',q=>q.order('material_id').order('location_id'));render();}
 await refresh();form();
 for(const id of ['catalog-search','catalog-state','catalog-unit'])$(id).addEventListener('input',render);
 $('catalog-list').addEventListener('click',e=>{const b=e.target.closest('[data-material]');if(!b||!canDiscard())return;form(masters.materials.find(m=>m.id===b.dataset.material));$('catalog-editor').scrollIntoView({block:'start'});$('catalog-name').focus();});
 for(const id of ['catalog-new','catalog-cancel'])$(id).addEventListener('click',()=>{if(canDiscard()){form();$('catalog-name').focus();}});
 $('catalog-form').addEventListener('input',()=>setDirty());
 $('catalog-form').addEventListener('submit',e=>{e.preventDefault();run(e.submitter,async()=>{
  const saved=check(await client.rpc('gest_save_master',{p_kind:'materials',p_id:editing?.id||newId,p_version:editing?.version||0,p_data:{name:$('catalog-name').value.trim(),code:$('catalog-code').value.trim(),unit:$('catalog-edit-unit').value,active:$('catalog-active').checked}}));
  editing=saved;setDirty(false);const i=masters.materials.findIndex(m=>m.id===saved.id);if(i<0)masters.materials.push(saved);else masters.materials[i]=saved;
  form();render();status('Materiale salvato nel catalogo. Per cambiare le quantità usa i movimenti del deposito.','success');
 });});
 $('catalog-refresh').addEventListener('click',()=>{if(canDiscard())run($('catalog-refresh'),async()=>{await refresh();form();status('Catalogo e giacenze aggiornati.','success');});});
 $('catalog-export').addEventListener('click',()=>download('catalogo-materiali-'+today()+'.csv',csv([['Codice','Materiale','Unità','Stato','Magazzini','Camion','Cantieri','Totale'],...visible.map(m=>[m.code,m.name,unitLabel(m.unit),m.active?'Attivo':'Archiviato',...['magazzino','camion','cantiere',null].map(k=>String(quantity(m.id,k)).replace('.',','))])]),'text/csv;charset=utf-8'));
}
