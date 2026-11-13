/* DoubleN contact popup. Nessuna dipendenza, cookie o richiesta remota automatica. */
(() => {
  'use strict';
  if (window.DoubleNFooter) return;
  if (!window.HTMLDialogElement || typeof HTMLDialogElement.prototype.showModal !== "function") return;
  const supplied = window.DOUBLEN_FOOTER_CONFIG || {};
  const config = {
    brandName: 'DoubleN Digital Solutions',
    website: 'https://doublen-digital-solutions-demo.brack04nc.chatgpt.site/',
    phone: '', email: '', googleProfile: '',
    ...supplied
  };
  const markPaths = '<path d="M0 96V0H28L83 65V44L100 64V96H71L28 44V96Z" fill="#12315a"/><path d="M60 0H89L130 49V0H160V96H133L78 30V52L60 30Z" fill="#f97316"/>';
  const paths = {
    site: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 4 3 14 0 18-3-4-3-14 0-18Z"/>',
    phone: '<path d="m8 3 3 5-3 3c2 3 3 4 6 6l3-3 4 3c1 1 0 4-2 4C10 21 3 14 3 5c0-2 4-3 5-2Z"/>',
    email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    google: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>'
  };
  const svg = key => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[key] + '</svg>';
  const text = value => typeof value === 'string' ? value.trim() : '';
  const httpsURL = value => {
    try { const url = new URL(text(value)); return url.protocol === 'https:' ? url.href : ''; }
    catch { return ''; }
  };
  const website = httpsURL(config.website);
  const googleProfile = httpsURL(config.googleProfile);
  const emailValue = text(config.email);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue) ? emailValue : '';
  const mailHref = email ? 'mailto:' + encodeURIComponent(email) : '';
  const phoneValue = text(config.phone);
  const phoneNumber = phoneValue.replace(/[\s().-]/g, '');
  const phone = /^\+?\d{6,16}$/.test(phoneNumber) ? phoneNumber : '';
  let dialog, previousTrigger, previousOverflow;

  function createDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'dn-contact-dialog';
    dialog.id = 'dn-contact-dialog';
    dialog.setAttribute('aria-labelledby', 'dn-contact-title');
    dialog.setAttribute('aria-describedby', 'dn-contact-intro');
    dialog.innerHTML = '<div class="dn-contact-dialog__header"><div class="dn-contact-dialog__brand"><svg viewBox="0 0 160 96" aria-hidden="true">' + markPaths + '</svg><div><strong>DoubleN</strong><small>Digital Solutions</small></div></div><button class="dn-contact-dialog__close" type="button" aria-label="Chiudi i contatti DoubleN" autofocus>' + svg('close') + '</button></div><div class="dn-contact-dialog__body"><p class="dn-contact-dialog__eyebrow">La tua idea, il nostro prossimo passo</p><h2 class="dn-contact-dialog__title" id="dn-contact-title">Due chiacchiere,<br>senza impegno.</h2><p class="dn-contact-dialog__intro" id="dn-contact-intro">Scrivici per una prima consulenza gratuita, anche solo per una chiacchierata: raccontaci la tua idea e capiamo insieme da dove partire.</p><div class="dn-contact-dialog__contacts"></div><a class="dn-contact-dialog__cta"></a><p class="dn-contact-dialog__note"></p></div>';
    const contacts = [
      {key:'site', label:'Sito', value:'Visita il sito DoubleN', href:website},
      {key:'phone', label:'Telefono', value:phoneValue, href:phone ? 'tel:' + phone : ''},
      {key:'email', label:'Email', value:email, href:mailHref},
      {key:'google', label:'Profilo Google', value:'Apri il profilo', href:googleProfile}
    ];
    const container = dialog.querySelector('.dn-contact-dialog__contacts');
    for (const item of contacts) {
      const card = document.createElement(item.href ? 'a' : 'div');
      card.className = 'dn-contact-card' + (item.href ? '' : ' dn-contact-card--pending');
      if (item.href) {
        card.href = item.href;
        if (item.href.startsWith('https:')) { card.target = '_blank'; card.rel = 'noopener noreferrer'; }
      }
      const label = document.createElement('span');
      label.className = 'dn-contact-card__label'; label.innerHTML = svg(item.key);
      const labelText = document.createElement('span'); labelText.textContent = item.label; label.append(labelText);
      const value = document.createElement('span'); value.className = 'dn-contact-card__value';
      value.textContent = item.href ? item.value : 'In definizione';
      card.append(label, value); container.append(card);
    }
    const cta = dialog.querySelector('.dn-contact-dialog__cta');
    if (email) {
      cta.href = mailHref + '?subject=' + encodeURIComponent('Una chiacchierata senza impegno con DoubleN');
      cta.append(document.createTextNode('Scrivici senza impegno'));
    } else if (phone) {
      cta.href = 'tel:' + phone;
      cta.append(document.createTextNode('Facciamo due chiacchiere'));
    } else if (website) {
      cta.href = website; cta.target = '_blank'; cta.rel = 'noopener noreferrer';
      cta.append(document.createTextNode('Visita il sito DoubleN'));
    } else { cta.remove(); }
    if (cta.isConnected || cta.parentNode) cta.insertAdjacentHTML('beforeend', svg('arrow'));
    const pending = contacts.some(item => !item.href);
    const note = dialog.querySelector('.dn-contact-dialog__note');
    note.textContent = pending ? (website ? 'Alcuni recapiti sono in fase di definizione. Intanto puoi conoscerci sul nostro sito.' : 'I recapiti sono in fase di definizione e saranno disponibili a breve.') : 'La prima consulenza è gratuita. Nessun impegno, nessuna fretta.';
    dialog.querySelector('.dn-contact-dialog__close').addEventListener('click', close);
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button:not([disabled]), a[href]')].filter(el => el.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault(); first?.focus();
      }
    });
    // Native dialog handles Escape, focus containment and an inert page background.
    dialog.addEventListener('close', () => {
      document.documentElement.style.overflow = previousOverflow;
      if (previousTrigger && previousTrigger.isConnected) previousTrigger.focus({preventScroll:true});
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close();
    });
    document.body.append(dialog);
    return dialog;
  }

  function open(trigger) {
    const modal = createDialog();
    if (modal.open) return;
    previousTrigger = trigger || document.activeElement;
    previousOverflow = document.documentElement.style.overflow;
    if (trigger) trigger.setAttribute('aria-controls', 'dn-contact-dialog');
    modal.showModal();
    modal.querySelector('.dn-contact-dialog__close').focus({preventScroll:true});
    document.documentElement.style.overflow = 'hidden';
  }
  function close() { if (dialog && dialog.open) dialog.close(); }
  document.addEventListener('click', event => {
    const trigger = event.target instanceof Element ? event.target.closest('[data-dn-contact-open]') : null;
    if (trigger) { event.preventDefault(); open(trigger); }
  });
  window.DoubleNFooter = Object.freeze({open, close});
  document.querySelectorAll('[data-dn-contact-open]').forEach(trigger => {
    trigger.hidden = false;
    const fallback = trigger.parentElement.querySelector('.dn-contact-fallback');
    if (fallback) fallback.hidden = true;
  });
})();
