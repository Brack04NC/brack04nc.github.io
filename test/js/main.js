/* Ponteggi Srls — interazioni progressive, senza dipendenze. */
"use strict";
document.documentElement.classList.remove("no-js");
const header = document.querySelector(".site-header");
const headerContent = header?.querySelector(".header-content");
function updateHeader() { header?.classList.toggle("is-scrolled", window.scrollY > 20); }
function measureCompactHeader() {
  if (!header || !headerContent) return;
  const styles = getComputedStyle(header);
  const padding = parseFloat(styles.getPropertyValue("--header-padding-scrolled")) || 8;
  const borders = (parseFloat(styles.borderTopWidth) || 0) + (parseFloat(styles.borderBottomWidth) || 0);
  const height = headerContent.getBoundingClientRect().height + padding * 2 + borders;
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
const inertState = new Map();
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
function closeMenu(restoreFocus = false) {
  if (!menu?.open) return;
  menu.open = false; syncMenu();
  if (restoreFocus) menuSummary.focus({ preventScroll: true });
}
menu?.addEventListener("toggle", syncMenu);
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
window.addEventListener("resize", () => { if (window.innerWidth >= 768) closeMenu(); });

/* Ancore: altezza finale dell'header + spazio di lettura, sottraendo
   il padding superiore della sezione dichiarato nel CSS. */
function findAnchor(hash) {
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
document.addEventListener("click", event => {
  const link = event.target.closest("a[href]");
  if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || normalizedPath(url.pathname) !== normalizedPath(location.pathname) || url.search !== location.search) return;
  const target = findAnchor(url.hash);
  if (!target) return;
  event.preventDefault(); initialAnchorPending = false; closeMenu();
  if (location.hash !== url.hash) history.pushState(null, "", url.hash);
  scrollToAnchor(target, matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", true);
});
if (/^#foto-\d{2}$/.test(location.hash) && !findAnchor(location.hash) && normalizedPath(location.pathname) === "/") location.replace("cantieri.html" + location.hash);
requestAnimationFrame(() => scrollToAnchor(findAnchor(location.hash)));
window.addEventListener("load", () => { if (initialAnchorPending) scrollToAnchor(findAnchor(location.hash)); initialAnchorPending = false; }, { once: true });
window.addEventListener("hashchange", () => { closeMenu(); scrollToAnchor(findAnchor(location.hash)); });

/* Il dialogo usa solo l'originale, senza sorgenti di anteprima.
   Titoli e descrizioni restano nell'HTML anche senza JavaScript. */
const photoDialog = document.querySelector("#photo-dialog");
const photoLinks = [...document.querySelectorAll("[data-photo]")];
if (photoDialog && typeof photoDialog.showModal === "function" && photoLinks.length) {
  const photoImage = photoDialog.querySelector(".photo-image");
  const photoTitle = photoDialog.querySelector("#photo-title");
  const photoDescription = photoDialog.querySelector("#photo-description");
  const photoCount = photoDialog.querySelector("[data-photo-count]");
  const originalLink = photoDialog.querySelector("[data-photo-original]");
  const photoError = photoDialog.querySelector(".photo-error");
  const photoLoading = photoDialog.querySelector("[data-photo-loading]");
  let photoVersion = 0;
  let photoIndex = 0, openingLink = null, savedScrollY = 0, swipeStart = null;
  function showPhoto(index) {
    photoIndex = (index + photoLinks.length) % photoLinks.length;
    const link = photoLinks[photoIndex];
    const card = link.closest(".project-card, .local-photo");
    const sourceImage = link.querySelector("img");
    photoTitle.textContent = card.querySelector("[data-photo-title], h3, h2").textContent.trim();
    photoDescription.textContent = card.querySelector("[data-photo-description], .project-description, figcaption p").textContent.trim();
    photoCount.textContent = `Foto ${photoIndex + 1} di ${photoLinks.length}`;
    photoImage.alt = sourceImage.alt;
    photoImage.width = Number(sourceImage.getAttribute("width")); photoImage.height = Number(sourceImage.getAttribute("height"));
    photoError.hidden = true; photoImage.hidden = true; photoLoading.hidden = false;
    const version = ++photoVersion;
    photoImage.src = link.href; originalLink.href = link.href;
    photoImage.decode().then(() => {
      if (version !== photoVersion || !photoDialog.open) return;
      photoImage.hidden = false; photoLoading.hidden = true;
    }).catch(() => {
      if (version !== photoVersion || !photoDialog.open) return;
      photoImage.hidden = true; photoLoading.hidden = true; photoError.hidden = false;
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

/* Mappa: consenso prima del caricamento e collegamento alternativo permanente. */
document.querySelectorAll("[data-map]").forEach(container => {
  const placeholder = container.querySelector("[data-map-placeholder]"), loaded = container.querySelector("[data-map-loaded]");
  const frame = container.querySelector("iframe"), loadButton = container.querySelector("[data-map-load]"), unloadButton = container.querySelector("[data-map-unload]");
  const status = container.querySelector("[data-map-status]");
  let timeout = null;
  loadButton.hidden = false;
  frame.addEventListener("load", () => {
    if (!frame.getAttribute("src")) return;
    clearTimeout(timeout); status.textContent = "Se la mappa non è visibile, usa il collegamento esterno qui sotto.";
  });
  frame.addEventListener("error", () => { status.textContent = "La mappa non è disponibile. Apri l’indirizzo tramite il collegamento esterno."; });
  loadButton.addEventListener("click", () => {
    placeholder.hidden = true; loaded.hidden = false; frame.hidden = false;
    status.textContent = "Caricamento della mappa… Il collegamento esterno rimane disponibile."; frame.src = frame.dataset.src;
    timeout = window.setTimeout(() => { status.textContent = "Se la mappa non compare, apri l’indirizzo tramite il collegamento esterno."; }, 10000);
    unloadButton.focus({ preventScroll: true });
  });
  unloadButton.addEventListener("click", () => {
    clearTimeout(timeout); frame.removeAttribute("src"); frame.hidden = true; loaded.hidden = true; placeholder.hidden = false;
    loadButton.focus({ preventScroll: true });
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
    submitButton.disabled = true; submitButton.textContent = "Invio in corso…"; form.setAttribute("aria-busy", "true");
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
      window.clearTimeout(timeout); form.removeAttribute("aria-busy"); status.hidden = false;
      status.setAttribute("tabindex", "-1"); status.focus({ preventScroll: true }); status.scrollIntoView({ block: "center", behavior: "instant" });
      submitButton.disabled = false; submitButton.textContent = initialLabel;
    }
  });
}

document.querySelectorAll("[data-current-year]").forEach(element => { element.textContent = new Date().getFullYear(); });
const legacyPages = { "#/privacy": "/privacy.html", "#/cookie-policy": "/cookie-policy.html", "#/termini-condizioni": "/termini-condizioni.html" };
if (legacyPages[location.hash]) location.replace(legacyPages[location.hash]);
