import {configurationError,connect,check,errorMessage,allRows} from './api.js?v=f8ee9f823b48';
import {today,download} from './helpers.js?v=f8ee9f823b48';
import {initAttendance,initArchive} from './presenze.js?v=f8ee9f823b48';
import {initDepot} from './deposito.js?v=f8ee9f823b48';
import {initMasters} from './anagrafiche.js?v=f8ee9f823b48';

import {initReport} from './riepilogo.js?v=f8ee9f823b48';
import {initWorker} from './operaio.js?v=f8ee9f823b48';
import {initMaterials} from './materiali.js?v=f8ee9f823b48';

import {initSites} from './cantieri.js?v=f8ee9f823b48';

const $=id=>document.getElementById(id);
const initialPageHTML=$('page-content').innerHTML;
let client,dirty=false,closing=false,user=null,ready=false,busy=false,lastActivity=Date.now();
const masters={};
document.querySelector('.workspace').classList.add('guest');
function status(message='',kind='info') {
  $('feedback').textContent=message;
  $('feedback').className='notice '+(kind==='info'?'':kind);
  if(kind==='error') $('feedback').focus({preventScroll:false});
}
function setDirty(value=true){dirty=value;}
function canDiscard(){return !dirty || window.confirm('Ci sono modifiche non salvate. Vuoi abbandonarle?');}
async function run(button,fn) {
  if(button?.disabled||busy) return;
  if(!navigator.onLine){status(errorMessage(new Error('network')),'error');return;}
  busy=true;
  if(button)button.disabled=true;
  $('page-content').inert=true;
  status();
  try{return await fn();}catch(e){if(e.code==='42501'&&ready){await exit('scaduto');}else status(errorMessage(e),'error');}
  finally{busy=false;$('page-content').inert=false;if(button)button.disabled=false;}
}
async function refreshMasters() {
  const entries=await Promise.all(['employees','sites','materials','locations'].map(async kind=>[kind,await allRows(client,kind,q=>['employees','sites'].includes(kind)?q.order('sort_order').order('name').order('id'):q.order('name').order('id'))]));
  for(const [kind,rows] of entries) masters[kind]=rows;
}
async function exit(message='') {
  if(closing)return;
  closing=true;dirty=false;
  $('page-content').hidden=true;$('sidebar').hidden=true;
  $('page-content').replaceChildren();
  for(const key of Object.keys(masters))delete masters[key];
  sessionStorage.removeItem('ponteggi-admin-session-v1');
  try{await client.auth.signOut({scope:'local'});}catch{/* La sessione locale è già eliminata. */}
  location.replace('index.html'+(message?'?accesso=scaduto':''));
}
async function verifyAccess() {
  const allowed=check(await client.rpc('gest_is_admin'));
  if(!allowed)throw Object.assign(new Error('Non abilitato'),{code:'42501'});
}
async function enter(session) {
  $('loading').hidden=false;$('login').hidden=true;
  try {
    await verifyAccess();user=session.user;
    await refreshMasters();
    $('auth-user').textContent=user.email||'Amministratore';
    $('sidebar').hidden=false;$('page-content').hidden=false;$('connection-badge').hidden=false;
    document.querySelector('.workspace').classList.remove('guest');
    const ctx={client,masters,$,status,run,setDirty,canDiscard,refreshMasters,check,allRows,user};
    const init={index:initDashboard,cantieri:initSites,presenze:initAttendance,deposito:initDepot,archivio:initArchive,anagrafiche:initMasters,riepilogo:initReport,operaio:initWorker,materiali:initMaterials}[document.body.dataset.page];
    if(!init)throw new Error('Pagina non valida');
    await init(ctx);ready=true;lastActivity=Date.now();
  } catch(e) {
    $('page-content').hidden=true;$('sidebar').hidden=true;$('connection-badge').hidden=true;
    $('page-content').innerHTML=initialPageHTML;$('auth-user').textContent='';
    for(const key of Object.keys(masters))delete masters[key];
    user=null;dirty=false;
    document.querySelector('.workspace').classList.add('guest');
    $('login').hidden=false;
    status(e.code==='42501'?'Questo account non è abilitato all’amministrazione. L’utente va aggiunto all’elenco autorizzato seguendo la guida.':errorMessage(e),'error');
    await client.auth.signOut({scope:'local'});
  } finally {$('loading').hidden=true;}
}
async function initDashboard(ctx) {
  const day=today();
  const [days,attendance]=await Promise.all([
    allRows(client,'days',q=>q.eq('day',day).order('compiler')),
    allRows(client,'attendance',q=>q.eq('day',day).order('employee_id'))
  ]);
  const present=new Set(attendance.filter(e=>e.present&&Number(e.hours)>0).map(e=>e.employee_id)).size;
  const hours=attendance.reduce((s,e)=>s+Number(e.hours),0);
  const stats=[['Presenti oggi',present,days.length?days.length+' registri salvati':'Giornata da compilare'],['Ore registrate',hours.toLocaleString('it-IT'),'Totale di oggi'],['Ubicazioni attive',masters.locations.filter(x=>x.active).length,'Magazzini, camion e cantieri']];
  $('dashboard-stats').replaceChildren(...stats.map(([label,value,hint])=>{const el=document.createElement('div');el.className='stat';const l=document.createElement('span'),v=document.createElement('strong'),h=document.createElement('span');l.textContent=label;v.textContent=value;h.textContent=hint;el.append(l,v,h);return el;}));
  $('today-summary').textContent=days.length?'Le presenze di oggi sono salvate in '+days.length+' registri. Puoi riaprirli per correggerli.':'Le presenze di oggi non sono ancora state registrate.';
  $('backup').addEventListener('click',()=>run($('backup'),async()=>{
    const data=check(await client.rpc('gest_export_backup'));
    download('ponteggi-backup-'+day+'.json',JSON.stringify(data,null,2));
    $('backup-result').textContent='Backup generato. Verifica il file scaricato e custodiscilo in un luogo riservato.';
    status('Backup completo generato.','success');
  }));
  $('password-form').addEventListener('submit',event=>{
    event.preventDefault();run(event.submitter,async()=>{
      const password=$('new-password').value;
      if(password!==$('confirm-password').value){status('Le nuove password non corrispondono.','error');return;}
      const reauth=await client.auth.signInWithPassword({email:user.email,password:$('current-password').value});
      if(reauth.error){status('Password attuale non corretta o accesso non riuscito.','error');return;}
      check(await client.auth.updateUser({password}));
      event.target.reset();status('Password aggiornata.','success');
    });
  });
}
function networkState(){
  $('offline').hidden=navigator.onLine;
  $('connection-badge').textContent=navigator.onLine?'Connesso':'Offline';
  $('connection-badge').className='badge '+(navigator.onLine?'ok':'warn');
}
window.addEventListener('online',networkState);window.addEventListener('offline',networkState);networkState();
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
document.addEventListener('click',e=>{
  const a=e.target.closest('a[href]');
  if(a&&!a.hash&&dirty){if(!canDiscard())e.preventDefault();else dirty=false;}
});
for(const event of ['pointerdown','keydown','input']) document.addEventListener(event,()=>{lastActivity=Date.now();},{passive:true});
setInterval(()=>{if(ready&&!closing&&Date.now()-lastActivity>30*60*1000)exit('scaduto');},30000);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&ready&&!closing&&navigator.onLine){
    if(Date.now()-lastActivity>30*60*1000){exit('scaduto');return;}
    verifyAccess().catch(e=>{if(e.code==='42501')exit('scaduto');else status(errorMessage(e),'error');});
  }
});
$('logout').addEventListener('click',()=>{if(canDiscard())exit();});

async function boot() {
  const configError=configurationError();
  if(configError){$('loading').hidden=true;$('login').hidden=false;status(configError,'warning');return;}
  try { client=connect(); }catch{ $('loading').hidden=true;status('Il browser non consente la sessione. Abilita l’archiviazione per questo sito e riprova.','error');return; }
  $('login-fields').disabled=false;
  client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'&&ready&&!closing)setTimeout(()=>exit('scaduto'),0);});
  $('login-form').addEventListener('submit',event=>{
    event.preventDefault();run(event.submitter,async()=>{
      const result=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
      if(result.error){status('Accesso non riuscito. Verifica email e password, connessione e stato del progetto Supabase.','error');return;}
      $('password').value='';await enter(result.data.session);
    });
  });
  try{
    const {session}=check(await client.auth.getSession());
    if(session)await enter(session);else{$('login').hidden=false;$('loading').hidden=true;}
    if(new URLSearchParams(location.search).has('accesso'))status('Sessione terminata. Accedi di nuovo per continuare.','warning');
  }catch(e){$('loading').hidden=true;$('login').hidden=false;status(errorMessage(e),'error');}
}
boot();
