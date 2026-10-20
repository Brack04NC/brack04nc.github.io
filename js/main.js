/* Ponteggi Srls — interazioni progressive, senza dipendenze. */
"use strict";
document.documentElement.classList.remove("no-js");
const header = document.querySelector(".site-header");
const headerContent = header?.querySelector(".header-content");
let headerCompact = null, measuredHeaderHeight = 0;
function updateHeader() {
  const compact = window.scrollY > 20;
  if (compact === headerCompact) return;
  headerCompact = compact; header?.classList.toggle("is-scrolled", compact);
}
function measureCompactHeader() {
  if (!header || !headerContent) return;
  const styles = getComputedStyle(header);
  const padding = parseFloat(styles.getPropertyValue("--header-padding-scrolled")) || 8;
  const borders = (parseFloat(styles.borderTopWidth) || 0) + (parseFloat(styles.borderBottomWidth) || 0);
  const height = headerContent.getBoundingClientRect().height + padding * 2 + borders;
  if (Math.abs(height - measuredHeaderHeight) < .5) return;
  measuredHeaderHeight = height;
  document.documentElement.style.setProperty("--header-height", `${height}px`);
}
updateHeader(); measureCompactHeader();
window.addEventListener("scroll", updateHeader, { passive: true });
window.addEventListener("resize", measureCompactHeader);
if (headerContent && window.ResizeObserver) new ResizeObserver(measureCompactHeader).observe(headerContent);

/* Il fallback <details> resta disponibile senza JS. Il pannello aperto
   rende inerti i rami esterni e mantiene Tab nei controlli del menu. */
const menu = document.querySelector(".mobile-menu");
const menuSummary = menu?.querySelector("summary");
const menuPanel = menu?.querySelector(".mobile-menu-panel");
const inertState = new Map();
let menuAnimation = null, menuPhase = "closed", closingMenu = null, finishMenuClose = null;
function syncMenu() {
  if (!menu) return;
  menuSummary.setAttribute("aria-label", menu.open ? "Chiudi menu" : "Apri menu");
  menuSummary.setAttribute("aria-expanded", String(menu.open));
  if (menu.open) {
    menu.setAttribute("role", "dialog"); menu.setAttribute("aria-modal", "true"); menu.setAttribute("aria-label", "Navigazione mobile");
    for (let branch = menu; branch.parentElement && branch !== document.body; branch = branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling === branch || inertState.has(sibling)) continue;
        inertState.set(sibling, sibling.inert); sibling.inert = true;
      }
    }
    menuSummary.focus({ preventScroll: true });
  } else {
    for (const [element, wasInert] of inertState) element.inert = wasInert;
    inertState.clear();
    menu.removeAttribute("role"); menu.removeAttribute("aria-modal"); menu.removeAttribute("aria-label");
  }
}
function openMenu() {
  if (!menu || menu.open || menuPhase === "closing") return;
  menuPhase = "opening"; menu.dataset.menuState = "opening";
  menu.open = true; syncMenu();
  if (!menuPanel.animate || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    menuPhase = "open"; menu.dataset.menuState = "open"; return;
  }
  menuAnimation = menuPanel.animate([{ transform: "translateX(100%)" }, { transform: "translateX(0)" }], { duration: 320, easing: "cubic-bezier(.22,1,.36,1)" });
  menuAnimation.onfinish = () => { menuAnimation = null; menuPhase = "open"; menu.dataset.menuState = "open"; };
}
function closeMenu(restoreFocus = false, immediate = false) {
  if (!menu?.open) return Promise.resolve();
  if (menuPhase === "closing") {
    if (immediate) { if (menuAnimation) { menuAnimation.onfinish = null; menuAnimation.cancel(); } finishMenuClose?.(); }
    return closingMenu;
  }
  const from = getComputedStyle(menuPanel).transform;
  if (menuAnimation) { menuAnimation.onfinish = null; menuAnimation.cancel(); menuAnimation = null; }
  menuPhase = "closing"; menu.dataset.menuState = "closing";
  let resolveClose;
  closingMenu = new Promise(resolve => { resolveClose = resolve; });
  const finish = () => {
    menu.open = false; menuPhase = "closed"; delete menu.dataset.menuState; menuAnimation = null; syncMenu();
    if (restoreFocus) menuSummary.focus({ preventScroll: true });
    finishMenuClose = null; resolveClose();
  };
  finishMenuClose = finish;
  if (immediate || !menuPanel.animate || matchMedia("(prefers-reduced-motion: reduce)").matches) finish();
  else {
    menuAnimation = menuPanel.animate([{ transform: from === "none" ? "translateX(0)" : from }, { transform: "translateX(100%)" }], { duration: 240, easing: "cubic-bezier(.4,0,1,1)" });
    menuAnimation.onfinish = finish;
  }
  return closingMenu;
}
menuSummary?.addEventListener("click", event => { event.preventDefault(); if (menu.open) closeMenu(true); else openMenu(); });
menu?.addEventListener("toggle", () => { if (!menu.open) menuPhase = "closed"; syncMenu(); });
menu?.querySelectorAll("a").forEach(link => link.addEventListener("click", () => closeMenu()));
menu?.addEventListener("click", event => { if (event.target === menu) closeMenu(true); });
document.addEventListener("keydown", event => {
  if (!menu?.open) return;
  if (event.key === "Escape") { event.preventDefault(); closeMenu(true); }
  else if (event.key === "Tab") {
    const controls = [...menu.querySelectorAll("summary, a[href], button:not([disabled])")].filter(element => element.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});
window.addEventListener("resize", () => { if (window.innerWidth >= 768) closeMenu(false, true); });

/* Ancore: altezza finale dell'header + spazio di lettura, sottraendo
   il padding superiore della sezione dichiarato nel CSS. */
function findAnchor(hash) {
  if (hash === "#zone") hash = "#chi-siamo";
  try { return hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null; } catch { return null; }
}
function scrollToAnchor(target, behavior = "instant", moveFocus = false) {
  if (!target) return;
  measureCompactHeader();
  const offset = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
  const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
  window.scrollTo({ top, behavior });
  if (moveFocus) {
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }
}
const normalizedPath = path => path.replace(/\/index\.html$/, "/");
let initialAnchorPending = Boolean(location.hash);
document.addEventListener("click", async event => {
  const link = event.target.closest("a[href]");
  if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || normalizedPath(url.pathname) !== normalizedPath(location.pathname) || url.search !== location.search) return;
  const target = findAnchor(url.hash);
  if (!target) return;
  event.preventDefault(); initialAnchorPending = false; await closeMenu();
  if (location.hash !== url.hash) history.pushState(null, "", url.hash);
  scrollToAnchor(target, matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", true);
});
if (/^#foto-\d{2}$/.test(location.hash) && !findAnchor(location.hash) && normalizedPath(location.pathname) === "/") location.replace("cantieri.html" + location.hash);
requestAnimationFrame(() => scrollToAnchor(findAnchor(location.hash)));
window.addEventListener("load", () => { if (initialAnchorPending) scrollToAnchor(findAnchor(location.hash)); initialAnchorPending = false; }, { once: true });
window.addEventListener("hashchange", async () => { await closeMenu(); scrollToAnchor(findAnchor(location.hash)); });

/* Il dialogo usa solo l'originale, senza sorgenti di anteprima.
   Titoli e descrizioni restano nell'HTML anche senza JavaScript. */
const photoDialog = document.querySelector("#photo-dialog");
const photoLinks = [...document.querySelectorAll("[data-photo]")];
if (photoDialog && typeof photoDialog.showModal === "function" && photoLinks.length) {
  const photoImage = photoDialog.querySelector(".photo-image");
  const photoTitle = photoDialog.querySelector("#photo-title");
  const photoDescription = photoDialog.querySelector("#photo-description");
  const photoCount = photoDialog.querySelector("[data-photo-count]");
  const photoRetry = photoDialog.querySelector("[data-photo-retry]");
  const photoError = photoDialog.querySelector(".photo-error");
  const photoLoading = photoDialog.querySelector("[data-photo-loading]");
  let photoVersion = 0;
  let photoIndex = 0, openingLink = null, savedScrollY = 0, swipeStart = null;
  function showPhoto(index) {
    photoIndex = (index + photoLinks.length) % photoLinks.length;
    const link = photoLinks[photoIndex];
    const card = link.closest(".project-card, .local-photo");
    const sourceImage = link.querySelector("img") || link.querySelector("template")?.content.querySelector("img");
    photoTitle.textContent = card.querySelector("[data-photo-title], h3, h2").textContent.trim();
    photoDescription.textContent = card.querySelector("[data-photo-description], .project-description, figcaption p").textContent.trim();
    photoCount.textContent = `Foto ${photoIndex + 1} di ${photoLinks.length}`;
    photoImage.alt = sourceImage.alt;
    photoImage.width = Number(sourceImage.getAttribute("width")); photoImage.height = Number(sourceImage.getAttribute("height"));
    photoError.hidden = true; photoRetry.hidden = true; photoImage.hidden = true; photoLoading.hidden = false;
    const version = ++photoVersion;
    photoImage.src = link.href;
    photoImage.decode().then(() => {
      if (version !== photoVersion || !photoDialog.open) return;
      photoImage.hidden = false; photoLoading.hidden = true;
    }).catch(() => {
      if (version !== photoVersion || !photoDialog.open) return;
      photoImage.hidden = true; photoLoading.hidden = true; photoError.hidden = false; photoRetry.hidden = false;
    });
    photoDialog.querySelector(".photo-detail").scrollTop = 0;
  }
  photoLinks.forEach((link, index) => {
    link.setAttribute("aria-haspopup", "dialog"); link.setAttribute("aria-controls", "photo-dialog");
    link.addEventListener("click", event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); openingLink = link; savedScrollY = window.scrollY;
      showPhoto(index); document.body.classList.add("photo-open"); photoDialog.showModal();
    });
  });
  photoDialog.querySelector("[data-photo-close]").addEventListener("click", () => photoDialog.close());
  photoDialog.querySelector("[data-photo-previous]").addEventListener("click", () => showPhoto(photoIndex - 1));
  photoDialog.querySelector("[data-photo-next]").addEventListener("click", () => showPhoto(photoIndex + 1));
  photoRetry.addEventListener("click", () => { photoImage.removeAttribute("src"); showPhoto(photoIndex); });
  photoDialog.querySelector(".photo-navigation").hidden = photoLinks.length < 2;
  photoDialog.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); showPhoto(photoIndex + (event.key === "ArrowRight" ? 1 : -1)); }
    else if (event.key === "Tab") {
      const controls = [...photoDialog.querySelectorAll("button:not([disabled]), a[href]")].filter(element => element.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  const viewer = photoDialog.querySelector(".photo-viewer");
  viewer.addEventListener("touchstart", event => { swipeStart = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }, { passive: true });
  viewer.addEventListener("touchend", event => {
    if (!swipeStart || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - swipeStart.x, dy = event.changedTouches[0].clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) showPhoto(photoIndex + (dx < 0 ? 1 : -1));
  }, { passive: true });
  viewer.addEventListener("touchcancel", () => { swipeStart = null; }, { passive: true });
  photoDialog.addEventListener("click", event => {
    if (event.target !== photoDialog) return;
    const bounds = photoDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) photoDialog.close();
  });
  photoDialog.addEventListener("close", () => {
    document.body.classList.remove("photo-open"); photoVersion++; photoLoading.hidden = true; photoImage.removeAttribute("src");
    openingLink?.focus({ preventScroll: true }); window.scrollTo({ top: savedScrollY, behavior: "instant" });
  });
}

/* Mappa: nessuna richiesta a Google finché la sezione è lontana.
   Senza JS resta disponibile l'iframe lazy nel fallback noscript. */
document.querySelectorAll('iframe[data-map-src]').forEach(map => {
  const load = () => { map.src = map.dataset.mapSrc; delete map.dataset.mapSrc; };
  if (!window.IntersectionObserver) { load(); return; }
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { load(); observer.disconnect(); }
  }, {rootMargin: '400px 0px'});
  observer.observe(map);
});

/* Nastro continuo: velocità costante in pixel al secondo, senza soste.
   Una copia visiva delle card chiude il ciclo mantenendo i 14 originali. */
document.querySelectorAll('[data-carousel]').forEach(carousel => {
  const track = carousel.querySelector('[data-carousel-track]');
  const cards = [...track.querySelectorAll('.project-card:not([data-carousel-clone])')];
  if (!cards.length) return;
  const controls = carousel.querySelector('[data-carousel-controls]');
  const counter = carousel.querySelector('[data-carousel-count]');
  const dots = carousel.querySelector('[data-carousel-dots]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const SPEED = 20;
  let cycle = 0, viewport = 0, position = 0, expected = 0, starts = [], current = -1;
  let frameId = 0, lastTime = null, resizeTimer = null, interacting = false;
  carousel.dataset.continuous = 'true';

  function openPhoto(event, card) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (photoDialog && typeof photoDialog.showModal === 'function') {event.preventDefault(); card.querySelector('[data-photo]').click();}
  }
  const copies = cards.map((card, i) => {
    const copy = card.cloneNode(true);
    copy.dataset.carouselClone = String(i); copy.setAttribute('aria-hidden', 'true');
    copy.removeAttribute('id'); copy.removeAttribute('aria-label'); copy.removeAttribute('aria-roledescription');
    copy.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    copy.querySelectorAll('[aria-describedby]').forEach(element => element.removeAttribute('aria-describedby'));
    copy.querySelectorAll('.project-photo').forEach(link => {
      link.removeAttribute('data-photo');
      link.addEventListener('click', event => openPhoto(event, card));
    });
    copy.querySelectorAll('a, button, [tabindex]').forEach(element => element.setAttribute('tabindex', '-1'));
    return copy;
  });
  track.append(...copies);
  const normalize = value => cycle ? ((value % cycle) + cycle) % cycle : 0;

  function renderControls(force = false) {
    const index = starts.reduce((best, left, i) => position + .5 >= left ? i : best, 0);
    if (index === current && !force) return;
    current = index; counter.textContent = `${index + 1} / ${cards.length}`; counter.setAttribute('aria-live', 'off');
    [...dots.children].forEach((dot, i) => dot.setAttribute('aria-pressed', String(i === index)));
    const active = dots.children[index];
    if (active && dots.scrollTo && dots.clientWidth) {
      const left = active.getBoundingClientRect().left - dots.getBoundingClientRect().left + dots.scrollLeft - (dots.clientWidth - active.offsetWidth) / 2;
      dots.scrollTo({left: Math.max(0, left), behavior: reduced.matches ? 'instant' : 'smooth'});
    }
  }
  function writePosition() {
    position = normalize(position);
    track.scrollLeft = position;
    // Conserva separatamente la frazione: alcuni browser arrotondano scrollLeft.
    expected = track.scrollLeft;
    renderControls();
  }
  function frame(now) {
    frameId = 0;
    if (document.hidden || cycle <= viewport || cards.length < 2) {lastTime = null; return;}
    const elapsed = lastTime === null ? 0 : Math.min(64, Math.max(0, now - lastTime));
    lastTime = now;
    if (!interacting) {
      position += (reduced.matches ? SPEED / 2 : SPEED) * elapsed / 1000;
      writePosition();
    }
    frameId = requestAnimationFrame(frame);
  }
  function start() {
    if (frameId || document.hidden || cycle <= viewport || cards.length < 2) return;
    lastTime = null; frameId = requestAnimationFrame(frame);
  }
  function measure() {
    const fraction = cycle ? position / cycle : 0;
    viewport = track.clientWidth;
    const first = cards[0].getBoundingClientRect();
    starts = cards.map(card => card.getBoundingClientRect().left - first.left);
    cycle = copies[0].getBoundingClientRect().left - first.left;
    // Il fallback consente l'avvio anche quando la copia non è ancora misurabile.
    if (cycle <= 0) cycle = cards.length > 1 ? starts[1] * cards.length : first.width;
    controls.hidden = cycle <= viewport || cards.length < 2;
    position = fraction * cycle; current = -1;
    writePosition(); lastTime = null; start();
  }
  function move(index) {
    const target = (index + cards.length) % cards.length;
    position = starts[target] || 0; writePosition(); lastTime = null; start();
  }
  dots.replaceChildren(...cards.map((_, i) => {
    const button = document.createElement('button'); button.type = 'button';
    button.setAttribute('aria-controls', track.id); button.setAttribute('aria-label', `Mostra cantiere ${i + 1} di ${cards.length}`);
    button.addEventListener('click', () => move(i)); return button;
  }));
  carousel.querySelector('[data-carousel-previous]').addEventListener('click', () => move(current - 1));
  carousel.querySelector('[data-carousel-next]').addEventListener('click', () => move(current + 1));
  track.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); move(event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : current + (event.key === 'ArrowRight' ? 1 : -1));
  });
  track.addEventListener('scroll', () => {
    if (Math.abs(track.scrollLeft - expected) <= 1) return;
    position = normalize(track.scrollLeft); writePosition(); lastTime = null;
  }, {passive: true});
  // Lo swipe controlla direttamente il nastro; al rilascio riprende subito.
  track.addEventListener('pointerdown', () => {interacting = true;}, {passive: true});
  function release() {
    if (!interacting) return;
    interacting = false; position = normalize(track.scrollLeft); writePosition(); lastTime = null; start();
  }
  window.addEventListener('pointerup', release, {passive: true});
  window.addEventListener('pointercancel', release, {passive: true});
  const resize = () => {clearTimeout(resizeTimer); resizeTimer = setTimeout(measure, 100);};
  if (window.ResizeObserver) new ResizeObserver(resize).observe(track);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {cancelAnimationFrame(frameId); frameId = 0; lastTime = null;}
    else {interacting = false; measure();}
  });
  reduced.addEventListener('change', () => {lastTime = null; start();});
  measure();
});

/* Copia esplicita accanto ai recapiti: i normali link tel/mailto rimangono
   disponibili per chiamare o scrivere. Nessun messaggio di successo falso. */
const copyStatus = document.querySelector("#copy-status");
let copyTimer = null, copyRequest = 0;
function announceCopy(message, error = false) {
  if (!copyStatus) return;
  clearTimeout(copyTimer); copyStatus.textContent = message;
  copyStatus.classList.toggle("is-error", error); copyStatus.classList.add("is-visible");
  copyTimer = setTimeout(() => { copyStatus.classList.remove("is-visible"); copyStatus.textContent = ""; }, 3200);
}
function legacyCopy(text) {
  const active = document.activeElement;
  const field = document.createElement("textarea"); field.className = "copy-buffer"; field.value = text; field.readOnly = true;
  field.setAttribute("aria-hidden", "true"); document.body.append(field); field.select();
  let copied = false;
  try { copied = document.execCommand("copy"); } catch { copied = false; }
  field.remove(); active?.focus({ preventScroll: true }); return copied;
}
document.querySelectorAll("[data-copy]").forEach(button => {
  button.hidden = false;
  button.addEventListener("click", async () => {
    const request = ++copyRequest; let copied = false; button.disabled = true;
    try {
      if (navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(button.dataset.copy); copied = true; } catch { copied = legacyCopy(button.dataset.copy); }
      } else copied = legacyCopy(button.dataset.copy);
      if (request === copyRequest) announceCopy(copied ? button.dataset.copySuccess : "Copia non riuscita. Seleziona il contatto e copialo manualmente.", !copied);
    } finally { button.disabled = false; }
  });
});

/* Telefono obbligatorio, email facoltativa: stessa regola senza JavaScript. */
const form = document.querySelector("#estimate-form");
if (form) {
  const services = { noleggio: "Noleggio ponteggi", montaggio: "Montaggio e smontaggio", completo: "Noleggio, montaggio e smontaggio", consulenza: "Consulenza per il cantiere" };
  const requested = new URLSearchParams(location.search).get("servizio");
  if (Object.hasOwn(services, requested)) form.elements.service.value = services[requested];
}
if (form && window.fetch) {
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (!form.reportValidity()) return;
    const submitButton = form.querySelector('[type="submit"]'); if (submitButton.disabled) return;
    const status = form.querySelector(".form-status"), initialLabel = submitButton.textContent;
    const payload = Object.fromEntries(new FormData(form).entries()); if (payload._honey) return;
    payload._subject = `Richiesta ponteggi — ${payload.area_richiesta || "Sito"} — ${payload.name}`;
    payload.service = payload.service || "Non specificato"; if (!payload.email) delete payload.email;
    // Conserva gli stati iniziali ed evita modifiche che andrebbero perse
    // quando l'invio già in corso viene confermato e il modulo si azzera.
    const fieldStates = [...form.elements].map(field => [field, field.disabled]);
    fieldStates.forEach(([field]) => { field.disabled = true; });
    submitButton.textContent = "Invio in corso…"; form.setAttribute("aria-busy", "true");
    status.hidden = true; status.classList.remove("is-error");
    const controller = new AbortController(), timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(form.action.replace("formsubmit.co/", "formsubmit.co/ajax/"), {
        method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(payload), signal: controller.signal
      });
      const result = await response.json();
      if (!response.ok || (result.success !== true && result.success !== "true")) throw new Error("Invio non confermato");
      status.textContent = "Richiesta inviata. Ti ricontatteremo al numero indicato o all’email, se compilata, per approfondire il cantiere. Disponibilità e condizioni saranno definite nella proposta.";
      form.reset();
      form.dispatchEvent(new CustomEvent("ponteggi:preventivo-inviato", { bubbles: true, detail: { area: payload.area_richiesta, pagina: payload.pagina_origine } }));
    } catch (error) {
      status.textContent = error.name === "AbortError"
        ? "Il servizio non ha confermato l’invio in tempo. La richiesta potrebbe essere arrivata: prima di inviarla di nuovo, contattaci per telefono o email."
        : "L’invio non è stato confermato. I dati restano nel modulo: puoi riprovare o contattarci per telefono o email.";
      status.classList.add("is-error");
    } finally {
      window.clearTimeout(timeout); fieldStates.forEach(([field, disabled]) => { field.disabled = disabled; });
      form.removeAttribute("aria-busy"); status.hidden = false;
      status.setAttribute("tabindex", "-1"); status.focus({ preventScroll: true }); status.scrollIntoView({ block: "center", behavior: "instant" });
      submitButton.disabled = false; submitButton.textContent = initialLabel;
    }
  });
}

document.querySelectorAll("[data-current-year]").forEach(element => { element.textContent = new Date().getFullYear(); });
const legacyPages = { "#/privacy": "/privacy.html", "#/cookie-policy": "/cookie-policy.html", "#/termini-condizioni": "/termini-condizioni.html" };
if (legacyPages[location.hash]) location.replace(legacyPages[location.hash]);
