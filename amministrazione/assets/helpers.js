export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function today(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const p = Object.fromEntries(parts.map(x => [x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function validDay(s) {
  if (!/^20\d{2}-\d{2}-\d{2}$|^2100-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s+'T12:00:00Z');
  return !Number.isNaN(+d) && d.toISOString().slice(0,10)===s;
}
export const number = value => new Intl.NumberFormat('it-IT',{maximumFractionDigits:3}).format(Number(value)||0);
export const displayDate = value => value ? new Intl.DateTimeFormat('it-IT',{dateStyle:'medium',timeZone:'Europe/Rome'}).format(new Date(value.length===10 ? value+'T12:00:00Z' : value)) : '—';
export const timestamp = value => value ? new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Rome'}).format(new Date(value)) : '—';
export const unitLabel = unit => unit==='mq' ? 'm²' : unit;
export function monthRange(month) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$|^2100-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Mese non valido');
  const [y,m]=month.split('-').map(Number);
  return [month+'-01',`${y}-${String(m).padStart(2,'0')}-${new Date(Date.UTC(y,m,0)).getUTCDate()}`];
}
export function summarize(rows, employees) {
  return employees.map(e=>{
    const entries=rows.filter(r=>r.employee_id===e.id);
    const hours=entries.reduce((s,r)=>s+Number(r.hours),0);
    return {...e,days:new Set(entries.filter(r=>r.present&&Number(r.hours)>0).map(r=>r.day)).size,hours,equivalent:hours/8};
  });
}
export function csv(rows) {
  const cell = value => {
    let s=String(value??'');
    // Evita formule eseguibili aprendo il CSV in Excel/LibreOffice.
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(s)) s="'"+s;
    return '"'+s.replaceAll('"','""')+'"';
  };
  return '\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n');
}
export function download(name, contents, type='application/json') {
  const url=URL.createObjectURL(new Blob([contents],{type}));
  const a=document.createElement('a'); a.href=url; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function validateEntries(entries) {
  if (!entries.length) throw new Error('Aggiungi almeno un nominativo nelle anagrafiche.');
  for (const e of entries) {
    const h=Number(e.hours);
    if (!Number.isFinite(h)||h<0||h>24||h*4!==Math.round(h*4)||(e.present?h===0:h!==0)) throw new Error('Controlla le ore: da 0,25 a 24 per i presenti, zero per gli assenti.');
  }
  return entries;
}
