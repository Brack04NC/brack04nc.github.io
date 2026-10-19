import {createClient} from '../vendor/supabase.js?v=ba2cf907944e';
import {config} from '../config.js?v=ba2cf907944e';

export function configurationError() {
  if (!config.supabaseUrl || !config.supabasePublishableKey) return 'Configurazione iniziale da completare. Consulta la guida GESTIONALE_E_GITHUB_PAGES.md inclusa nello ZIP e compila amministrazione/config.js.';
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.supabaseUrl) || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.supabasePublishableKey)) return 'Configurazione non valida: usa l’URL del progetto Supabase e la chiave publishable (sb_publishable_). Non inserire chiavi segrete.';
  return '';
}
export function connect() {
  return createClient(config.supabaseUrl,config.supabasePublishableKey,{
    auth:{persistSession:true,storage:sessionStorage,storageKey:'ponteggi-admin-session-v1',autoRefreshToken:true,detectSessionInUrl:false},
    global:{headers:{'X-Client-Info':'ponteggi-gestionale/1.0'}}
  });
}
export function check(result) {
  if (result.error) throw result.error;
  return result.data;
}
export function errorMessage(error) {
  const m=String(error?.message||error||'');
  if (!navigator.onLine || /fetch|network|Failed to send/i.test(m)) return 'Connessione non disponibile. Il salvataggio non è confermato: controlla la rete e riprova senza chiudere la pagina.';
  if (error?.code==='40001'||m.includes('CONFLICT')) return 'Un altro accesso ha modificato questi dati. Annota le tue modifiche e ricarica prima di salvare.';
  if (error?.code==='23505') return 'Codice, targa o identificativo già presente. Ricarica e controlla prima di riprovare.';
  if (error?.code==='42501'||/JWT|token.*expired/i.test(m)) return 'Accesso scaduto o non autorizzato. Esci ed effettua nuovamente l’accesso; se persiste, verifica l’abilitazione dell’utente.';
  if (error?.code==='PGRST202'||error?.code==='42P01') return 'Database non ancora configurato: esegui backend/01-schema.sql come indicato nella guida.';
  if (error?.code==='23514'||error?.code==='23502'||error?.code==='22P02') return 'Valori non validi o incompleti. Controlla i campi e le quantità.';
  if (m.length>0 && m.length<500 && error?.code==='P0001') return m;
  return 'Operazione non riuscita. I dati non sono confermati: ricarica e verifica la configurazione o riprova.';
}
export async function allRows(client, table, build=q=>q) {
  const result=[];
  for(let start=0;start<100000;start+=1000) {
    const rows=check(await build(client.from('gest_'+table).select('*')).range(start,start+999));
    result.push(...rows);
    if(rows.length<1000) return result;
  }
  throw new Error('LIMIT: esportazione superiore a 100.000 righe. Ridurre l’intervallo.');
}
