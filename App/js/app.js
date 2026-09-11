// ============================================================
// USS — Application
// Routeur d'écrans + rendu. Aucune dépendance externe.
// ============================================================
import { CLUB } from "./config.js";
import { store } from "./store.js";
import { installLens } from "./lens.js";

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const initials = (p) => `${p.first?.[0] || ""}${p.last?.[0] || ""}`.toUpperCase();
const clubInitials = (name) => name.split(/[\s-]+/).filter((w) => w.length > 1 && !/^(de|du|des|la|le|les|st|saint)$/i.test(w)).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
const fullName = (p) => `${p.first} ${p.last}`;
const nowIso = () => new Date().toISOString();
const inDays = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString(); };

const MONTHS = ["jan", "fév", "mar", "avr", "mai", "juin", "juil", "août", "sep", "oct", "nov", "déc"];
const DAYS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
function fmt(dateStr) {
  const dt = new Date(dateStr);
  return { day: dt.getDate(), month: MONTHS[dt.getMonth()], dow: DAYS[dt.getDay()], time: dt.toTimeString().slice(0, 5) };
}
const ordinal = (n) => `${n}<sup>${n === 1 ? "er" : "e"}</sup>`;

// ---------- état UI ----------
const ui = { screen: "home", teamFilter: null, calTeam: null, period: "week" };

// ---------- icônes ----------
const ICONS = {
  home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  table: '<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
  stats: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
};
const TABS = [
  { id: "home", label: "Accueil", icon: "home" },
  { id: "calendar", label: "Agenda", icon: "cal" },
  { id: "table", label: "Classement", icon: "table" },
  { id: "stats", label: "Stats", icon: "stats" },
  { id: "profile", label: "Profil", icon: "user" },
];

// ---------- rendu global ----------
// La coquille (écran + barre d'onglets) est créée une fois ; seul #screen est re-rendu,
// pour que la bulle de la barre puisse glisser d'un onglet à l'autre sans être recréée.
function render() {
  const app = $("#app");
  const me = store.me();
  if (!me) { app.innerHTML = renderAuth(); bindAuth(); return; }
  if (!$("#screen", app)) {
    app.innerHTML = `<div id="screen"></div>${navHtml()}<div class="toast" id="toast"></div>`;
    bindNav();
  }
  const screens = { home: renderHome, calendar: renderCalendar, table: renderTable, stats: renderStats, profile: renderProfile };
  $("#screen").innerHTML = `
    <header class="top">
      <div class="top-row">
        <div class="brand"><div class="crest">${esc(CLUB.short)}</div><h1 class="wordmark">${esc(CLUB.short)}</h1></div>
        <button class="top-btn" data-tab="profile">${me.role === "coach" ? "Coach" : "#" + (me.number ?? "")} · ${esc(me.first)}</button>
      </div>
    </header>
    <main>${screens[ui.screen](me)}</main>`;
  $("#screen").querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => goTo(b.dataset.tab));
  setActiveTab(ui.screen, true);
  bindScreen(me);
}
function goTo(id) {
  if (ui.screen === id) return;
  ui.screen = id;
  window.scrollTo(0, 0);
  render();
}

// ---------- barre d'onglets : bulle de verre ----------
function navHtml() {
  return `<nav class="tabs" aria-label="Navigation">
    <div class="glass"></div>
    <div class="bubble"></div>
    ${TABS.map((t) => `<button data-nav="${t.id}" class="${ui.screen === t.id ? "on" : ""}">${ICONS[t.icon]}${t.label}</button>`).join("")}
  </nav>`;
}
const nav = { el: null, glass: null, bubble: null, anim: null, syncing: false, syncUntil: 0 };
const GROW = 1.12; // grossissement "loupe" quand on tient ou déplace le surlignage
function tabRect(id) {
  const b = nav.el.querySelector(`[data-nav="${id}"]`);
  return { x: b.offsetLeft, w: b.offsetWidth };
}
function bubbleTarget(id) {
  const { x, w } = tabRect(id);
  const bw = Math.min(w + 10, 92);
  return { x: x + (w - bw) / 2, w: bw };
}
function setActiveTab(id, animate) {
  if (!nav.el) return;
  nav.el.querySelectorAll("[data-nav]").forEach((b) => b.classList.toggle("on", b.dataset.nav === id));
  const to = bubbleTarget(id);
  const b = nav.bubble;
  const from = b._x ?? to.x;
  b.style.width = to.w + "px";
  if (nav.anim) nav.anim.cancel();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!animate || reduced || Math.abs(to.x - from) < 1) {
    b.style.transform = `translateX(${to.x}px)`;
    settle();
  } else {
    if (nav.flat) { nav.el.classList.add("flat"); nav.flat = false; } else { nav.el.classList.add("active"); keepSynced(); }
    // la barre entière se décale à peine dans le sens du mouvement, puis revient
    nav.el.style.setProperty("--shift", `${Math.sign(to.x - from) * Math.min(1.5, Math.abs(to.x - from) / 120)}px`);
    setTimeout(() => nav.el && nav.el.style.setProperty("--shift", "0px"), 200);
    // glissement avec étirement au milieu du trajet, puis retour élastique
    const stretch = 1 + Math.min(.3, Math.abs(to.x - from) / 300);
    const g = nav.el.classList.contains("active") ? GROW : 1;
    nav.anim = b.animate(
      [
        { transform: `translateX(${from}px) scale(${g})` },
        { transform: `translateX(${(from + to.x) / 2}px) scale(${g}) scaleX(${stretch}) scaleY(${1 - (stretch - 1) * .4})`, offset: .45 },
        { transform: `translateX(${to.x}px) scale(${1 + (g - 1) * .4}) scaleX(.97)`, offset: .8 },
        { transform: `translateX(${to.x}px) scale(1)` },
      ],
      { duration: 520, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" }
    );
    nav.anim.onfinish = () => { b.style.transform = `translateX(${to.x}px)`; nav.anim.cancel(); nav.anim = null; settle(); };
    // pendant le trajet, les onglets se colorent au passage du surlignage
    const tick = () => {
      if (!nav.anim || !nav.el) return;
      const m = new DOMMatrixReadOnly(getComputedStyle(b).transform);
      paintTabs(m.e + b.offsetWidth / 2);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  b._x = to.x;
}
// le trou dans le verre suit la boîte réelle du surlignage (transform inclus), tant qu'il est actif
function syncHole() {
  if (!nav.el || !nav.glass) return;
  const b = nav.bubble, m = new DOMMatrixReadOnly(getComputedStyle(b).transform);
  const w = b.offsetWidth, h = b.offsetHeight;
  nav.glass.style.setProperty("--hx", `${b.offsetLeft + m.e + (w - w * m.a) / 2}px`);
  nav.glass.style.setProperty("--hy", `${b.offsetTop + m.f + (h - h * m.d) / 2}px`);
  nav.glass.style.setProperty("--hw", `${w * m.a}px`);
  nav.glass.style.setProperty("--hh", `${h * m.d}px`);
}
function keepSynced(ms = 400) {
  nav.syncUntil = performance.now() + ms;
  if (nav.syncing) return;
  nav.syncing = true;
  const loop = () => {
    if (!nav.el) { nav.syncing = false; return; }
    syncHole();
    if (nav.el.classList.contains("active") || performance.now() < nav.syncUntil) requestAnimationFrame(loop);
    else nav.syncing = false;
  };
  requestAnimationFrame(loop);
}
// intensité de couleur de chaque onglet selon la proximité du surlignage (0 → gris, 1 → couleur du club)
function paintTabs(cx) {
  if (!nav.el) return;
  nav.el.querySelectorAll("[data-nav]").forEach((btn) => {
    const c = btn.offsetLeft + btn.offsetWidth / 2;
    const t = Math.max(0, Math.min(1, 1 - Math.abs(cx - c) / (btn.offsetWidth * .9)));
    btn.style.setProperty("--t", t.toFixed(3));
  });
}
function clearPaint() { if (nav.el) nav.el.querySelectorAll("[data-nav]").forEach((btn) => btn.style.removeProperty("--t")); }
// la bulle redevient discrète une fois posée (sauf si le doigt est encore dessus)
function settle() {
  if (!nav.el) return;
  clearPaint();
  if (!nav.el.classList.contains("pressed")) nav.el.classList.remove("active", "flat");
}
function bindNav() {
  nav.el = $("nav.tabs");
  nav.glass = $(".glass", nav.el);
  nav.bubble = $(".bubble", nav.el);
  let drag = null;
  const nearest = (px) => {
    let best = TABS[0].id, d = Infinity;
    TABS.forEach((t) => { const r = tabRect(t.id); const c = r.x + r.w / 2; if (Math.abs(c - px) < d) { d = Math.abs(c - px); best = t.id; } });
    return best;
  };
  nav.el.addEventListener("pointerdown", (e) => {
    const rect = nav.el.getBoundingClientRect();
    drag = { start: e.clientX, rect, moved: false, lastX: e.clientX, lastT: performance.now(), tab: null, btn: e.target.closest("[data-nav]") };
    nav.el.setPointerCapture(e.pointerId);
    nav.el.classList.add("pressed", "active");
    if (!nav.anim) nav.bubble.style.transform = `translateX(${nav.bubble._x ?? 0}px) scale(${GROW})`;
    keepSynced();
  });
  nav.el.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const px = e.clientX - drag.rect.left;
    if (!drag.moved && Math.abs(e.clientX - drag.start) < 6) return;
    if (!drag.moved) { drag.moved = true; nav.el.classList.add("dragging"); if (nav.anim) { nav.anim.cancel(); nav.anim = null; } }
    const now = performance.now();
    const v = (e.clientX - drag.lastX) / Math.max(1, now - drag.lastT); // px/ms
    drag.lastX = e.clientX; drag.lastT = now;
    const w = nav.bubble.offsetWidth;
    const x = Math.max(4, Math.min(drag.rect.width - w - 4, px - w / 2));
    const stretch = 1 + Math.min(.3, Math.abs(v) * .4);
    nav.bubble.style.transform = `translateX(${x}px) scale(${GROW}) scaleX(${stretch}) scaleY(${1 - (stretch - 1) * .4})`;
    nav.bubble._x = x;
    // la barre suit très légèrement le doigt (au plus 1,5 px de chaque côté)
    const rel = (px - drag.rect.width / 2) / (drag.rect.width / 2);
    nav.el.style.setProperty("--shift", `${Math.max(-1.5, Math.min(1.5, rel * 1.5))}px`);
    paintTabs(x + w / 2);
    drag.tab = nearest(px);
  });
  const end = (e) => {
    if (!drag) return;
    const d = drag; drag = null;
    nav.el.classList.remove("dragging", "pressed", "active");
    nav.el.style.setProperty("--shift", "0px");
    nav.flat = d.moved;
    let target;
    if (d.moved) target = d.tab || nearest(e.clientX - d.rect.left);
    else target = d.btn ? d.btn.dataset.nav : null;
    if (!target || target === ui.screen) { setActiveTab(ui.screen, false); return; }
    goTo(target); // render() replace l'écran et anime la bulle vers l'onglet
  };
  nav.el.addEventListener("pointerup", end);
  nav.el.addEventListener("pointercancel", end);
  addEventListener("resize", () => setActiveTab(ui.screen, false));
}

// ---------- auth ----------
function renderAuth() {
  const demo = store.demo ? `
      <div class="notice">Mode démonstration : la connexion par mot de passe s'activera une fois la base de données branchée. Choisis un profil pour tester l'app.</div>
      <h3 class="section">Entrer comme…</h3>
      <div class="demo-list">
        ${store.profiles().map((p) => `
          <button data-demo="${p.id}">
            <span><b>${esc(fullName(p))}</b><br><span class="small muted">${p.team_ids.map((t) => store.team(t).name).join(", ")}</span></span>
            <span class="chip ${p.role === "coach" ? "coach" : ""}">${p.role === "coach" ? "Entraîneur" : "Joueur"}</span>
          </button>`).join("")}
      </div>` : "";
  return `
    <main class="auth">
      <div class="crest">${esc(CLUB.short)}</div>
      <h1>Union Sportive<br>Savigny-lès-Beaune</h1>
      <div class="sub">${esc(CLUB.postcode)} · saison ${esc(CLUB.season)}</div>
      <form id="login" class="card">
        <div class="field"><label>E-mail</label><input type="email" name="email" autocomplete="username" placeholder="prenom@exemple.fr" ${store.demo ? "disabled" : ""}></div>
        <div class="field"><label>Mot de passe</label><input type="password" name="password" autocomplete="current-password" ${store.demo ? "disabled" : ""}></div>
        <button class="btn primary block" ${store.demo ? "disabled" : ""}>Se connecter</button>
        <div class="error" id="login-error"></div>
      </form>
      ${demo}
    </main>`;
}
function bindAuth() {
  document.querySelectorAll("[data-demo]").forEach((b) => b.onclick = async () => { await store.demoLogin(b.dataset.demo); ui.screen = "home"; window.scrollTo(0, 0); render(); });
  $("#login").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try { await store.login(f.get("email"), f.get("password")); render(); }
    catch (err) { $("#login-error").textContent = err.message; }
  };
}

// ---------- accueil ----------
function renderHome(me) {
  const mine = store.events(me.team_ids);
  const upcoming = mine.filter((e) => e.date >= nowIso());
  const next = upcoming[0];
  const recent = mine.filter((e) => e.type === "match" && e.score_for != null).slice(-3).reverse();
  const pending = me.role === "player" ? upcoming.filter((e) => !store.myStatus(e.id)).length : 0;
  const hello = new Date().getHours() < 18 ? "Bonjour" : "Bonsoir";
  return `
    <h2 class="screen-title">${hello}, ${esc(me.first)}</h2>
    ${pending ? `<div class="notice">Tu n'as pas encore répondu à <b>${pending}</b> convocation${pending > 1 ? "s" : ""}. Va dans l'agenda pour indiquer ta présence.</div>` : ""}
    ${next ? nextCard(next, me) : `<div class="card empty">Rien de prévu pour le moment.</div>`}
    <h3 class="section"><span><span class="star">★</span>Mes équipes</span><a class="muted" data-tab="table">Classement ›</a></h3>
    ${me.team_ids.map((tid) => {
      const t = store.team(tid);
      const rows = store.standings(tid);
      const pos = rows.findIndex((r) => r.us) + 1;
      const us = rows.find((r) => r.us);
      return `<div class="card row between">
        <div class="row"><div class="crest">${esc(t.short)}</div><div><b>${esc(t.name)}</b><div class="small muted">${esc(t.competition)}</div></div></div>
        ${pos ? `<div style="text-align:right"><div class="event-title">${ordinal(pos)} <span class="muted small">/ ${rows.length}</span></div><div class="small muted">${us.pts} pts</div></div>` : `<span class="muted small">—</span>`}
      </div>`;
    }).join("")}
    <h3 class="section"><span>Derniers résultats</span><a class="muted" data-tab="calendar">Agenda ›</a></h3>
    ${recent.length ? recent.map((e) => `<div class="card flush">${matchRow(e)}</div>`).join("") : `<div class="card empty">Pas encore de match joué.</div>`}
  `;
}

// carte "prochain rendez-vous" façon héros
function nextCard(e, me) {
  const f = fmt(e.date);
  const t = store.team(e.team_id);
  const isMatch = e.type === "match";
  const att = store.attendance(e.id);
  const yes = Object.values(att).filter((s) => s === "yes").length;
  const isPlayer = me.team_ids.includes(e.team_id) && me.role === "player";
  return `
    <div class="card hero" data-event="${e.id}">
      <div class="watermark">${f.day}</div>
      <div class="row" style="gap:6px;margin-bottom:10px"><span class="chip">${isMatch ? "Prochain match" : "Prochain entraînement"}</span><span class="chip">${esc(t.short)}</span></div>
      <div style="font-family:var(--f-display);font-weight:800;font-size:26px;letter-spacing:-.03em;line-height:1.05">${isMatch ? (e.home ? `USS <span style="opacity:.6">vs</span> ${esc(e.opponent)}` : `${esc(e.opponent)} <span style="opacity:.6">vs</span> USS`) : "Entraînement"}</div>
      <div class="muted" style="margin-top:6px;font-size:13.5px">${f.dow}. ${f.day} ${f.month} · ${f.time} · ${esc(e.place)}</div>
      ${e.note ? `<div class="small" style="margin-top:4px;opacity:.9">${esc(e.note)}</div>` : ""}
      <div class="stats">
        <div class="stat"><b>${yes}</b><span>présents</span></div>
        <div class="stat"><b>${store.profiles(e.team_id).filter((p) => p.role === "player").length - Object.keys(att).length}</b><span>sans réponse</span></div>
        <div class="stat"><b>${isMatch ? (e.home ? "DOM" : "EXT") : f.time}</b><span>${isMatch ? "terrain" : "coup d'envoi"}</span></div>
      </div>
      ${isPlayer ? rsvpBar(e.id, "hero") : ""}
    </div>`;
}
function rsvpBar(eventId, variant = "") {
  const mine = store.myStatus(eventId);
  return `<div class="rsvp ${variant}" style="margin-top:14px">
    <button class="yes ${mine === "yes" ? "on" : ""}" data-rsvp="yes">Présent</button>
    <button class="maybe ${mine === "maybe" ? "on" : ""}" data-rsvp="maybe">Incertain</button>
    <button class="no ${mine === "no" ? "on" : ""}" data-rsvp="no">Absent</button>
  </div>`;
}

// ---------- lignes d'événements ----------
function matchRow(e) {
  const f = fmt(e.date);
  const t = store.team(e.team_id);
  const played = e.score_for != null;
  const cls = played ? (e.score_for > e.score_against ? "win" : e.score_for < e.score_against ? "loss" : "draw") : "";
  const us = `<div class="side"><div class="crest lg">${esc(CLUB.short)}</div><span>USS ${t.short !== "SA" ? esc(t.short) : ""}</span></div>`;
  const them = `<div class="side"><div class="crest lg away">${esc(clubInitials(e.opponent || "?"))}</div><span>${esc(e.opponent)}</span></div>`;
  return `
    <div class="match-meta">${esc(t.competition || t.name)} · ${f.dow}. ${f.day} ${f.month}${e.home ? " · domicile" : " · extérieur"}</div>
    <div class="match">
      ${e.home ? us : them}
      <div class="mid"><div class="big ${cls}">${played ? `${e.home ? e.score_for : e.score_against}–${e.home ? e.score_against : e.score_for}` : f.time}</div><div class="sub">${played ? "Terminé" : esc(e.place)}</div></div>
      ${e.home ? them : us}
    </div>`;
}
function eventCard(e, me, { showTeam = true } = {}) {
  const f = fmt(e.date);
  const t = store.team(e.team_id);
  const att = store.attendance(e.id);
  const counts = { yes: 0, maybe: 0, no: 0 };
  Object.values(att).forEach((s) => counts[s]++);
  const isPlayer = me.team_ids.includes(e.team_id) && me.role === "player";
  const coach = store.isCoachOf(e.team_id);
  const played = e.type === "match" && e.score_for != null;
  const past = e.date < nowIso();
  const body = e.type === "match" ? matchRow(e) : `
    <div class="event-row">
      <div class="date-block"><b>${f.day}</b><span>${f.month}</span></div>
      <div class="grow">
        <div class="row" style="gap:6px;margin-bottom:4px"><span class="chip training">Entraînement</span>${showTeam ? `<span class="chip">${esc(t.short)}</span>` : ""}</div>
        <div class="event-title">${f.dow}. ${f.time} · ${esc(e.place)}</div>
        ${e.note ? `<div class="small muted" style="margin-top:2px">${esc(e.note)}</div>` : ""}
      </div>
    </div>`;
  return `
    <div class="card flush" data-event="${e.id}">
      ${body}
      ${!played ? `<div class="card-foot">
        ${isPlayer && !past ? rsvpBar(e.id) : ""}
        <div class="row between">
          <div class="counts"><span><b>${counts.yes}</b> présents</span><span><b>${counts.maybe}</b> incertains</span><span><b>${counts.no}</b> absents</span></div>
          ${coach ? `<button class="btn sm ghost" data-edit="${e.id}">Modifier</button>` : ""}
        </div>
        <div class="avatars">${store.profiles(e.team_id).filter((p) => p.role === "player").map((p) => `<span class="avatar ${att[p.id] || ""}" title="${esc(fullName(p))}">${initials(p)}</span>`).join("")}</div>
      </div>` : coach ? `<div class="card-foot row" style="justify-content:flex-end"><button class="btn sm ghost" data-edit="${e.id}">Modifier</button></div>` : ""}
    </div>`;
}

// ---------- agenda ----------
function teamPills(me, allowAll = true, key = "teamFilter") {
  const ids = store.teams().map((t) => t.id);
  if (ui[key] && !ids.includes(ui[key])) ui[key] = null;
  if (!allowAll && !ui[key]) ui[key] = me.team_ids[0] || ids[0];
  return `<div class="pills">
    ${allowAll ? `<button class="pill ${!ui[key] ? "on" : ""}" data-team="" data-key="${key}">★ Mes équipes</button>` : ""}
    ${ids.map((id) => `<button class="pill ${ui[key] === id ? "on" : ""}" data-team="${id}" data-key="${key}">${esc(store.team(id).short)}</button>`).join("")}
  </div>`;
}
function renderCalendar(me) {
  const teamIds = ui.calTeam ? [ui.calTeam] : me.team_ids;
  const all = store.events(teamIds);
  const now = nowIso();
  const lists = {
    past: all.filter((e) => e.date < now).reverse(),
    week: all.filter((e) => e.date >= now && e.date < inDays(7)),
    later: all.filter((e) => e.date >= inDays(7)),
  };
  const list = lists[ui.period];
  const emptyMsg = { past: "Aucun événement passé.", week: "Rien dans les 7 prochains jours.", later: "Rien de planifié plus loin." }[ui.period];
  return `
    <h2 class="screen-title">Agenda</h2>
    <div class="seg">
      <button data-period="past" class="${ui.period === "past" ? "on" : ""}">Passés</button>
      <button data-period="week" class="${ui.period === "week" ? "on" : ""}">Cette semaine</button>
      <button data-period="later" class="${ui.period === "later" ? "on" : ""}">À venir</button>
    </div>
    ${teamPills(me, true, "calTeam")}
    ${list.length ? list.map((e) => eventCard(e, me)).join("") : `<div class="card empty">${emptyMsg}</div>`}
    ${me.role === "coach" ? `<button class="fab" id="add-event" title="Ajouter une séance ou un match">+</button>` : ""}
  `;
}

// ---------- classement ----------
function renderTable(me) {
  const tid = ui.teamFilter || me.team_ids[0];
  const t = store.team(tid);
  const rows = store.standings(tid);
  const matches = store.events([tid]).filter((e) => e.type === "match");
  return `
    <h2 class="screen-title">Classement</h2>
    ${teamPills(me, false)}
    <div class="card flush">
      <div style="padding:14px 14px 4px"><b>${esc(t.name)}</b><div class="small muted">${esc(t.competition)}</div></div>
      ${rows.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>Équipe</th><th>MJ</th><th>V</th><th>N</th><th>D</th><th>DB</th><th>PTS</th></tr></thead>
        <tbody>${rows.map((r, i) => `<tr class="${r.us ? "us" : ""}"><td>${i + 1}</td>
          <td><span class="club-cell"><span class="crest ${r.us ? "" : "away"}">${esc(r.us ? CLUB.short : clubInitials(r.club))}</span>${esc(r.club)}</span></td>
          <td>${r.j}</td><td>${r.g}</td><td>${r.n}</td><td>${r.p}</td><td>${r.diff > 0 ? "+" : ""}${r.diff}</td><td class="pts">${r.pts}</td></tr>`).join("")}</tbody>
      </table></div>` : `<div class="empty">Pas de classement pour cette équipe (plateau ou compétition sans classement).</div>`}
    </div>
    <h3 class="section">Matchs</h3>
    ${matches.length ? matches.map((e) => `<div class="card flush">${matchRow(e)}</div>`).join("") : `<div class="card empty">Aucun match programmé.</div>`}
  `;
}

// ---------- stats ----------
function renderStats(me) {
  const tid = ui.teamFilter || me.team_ids[0];
  const rows = store.stats(tid);
  const matches = store.events([tid]).filter((e) => e.type === "match" && e.score_for != null);
  const w = matches.filter((e) => e.score_for > e.score_against).length;
  const n = matches.filter((e) => e.score_for === e.score_against).length;
  const goals = rows.reduce((a, r) => a + r.goals, 0);
  const top = rows.filter((r) => r.goals > 0).slice(0, 3);
  const max = top[0]?.goals || 1;
  return `
    <h2 class="screen-title">Statistiques</h2>
    ${teamPills(me, false)}
    <div class="stats">
      <div class="stat"><b>${matches.length}</b><span>matchs joués</span></div>
      <div class="stat"><b>${w}-${n}-${matches.length - w - n}</b><span>V - N - D</span></div>
      <div class="stat"><b>${goals}</b><span>buts marqués</span></div>
    </div>
    <div class="card flush">
      <div style="padding:14px 14px 0"><b>Meilleurs buteurs</b></div>
      ${top.length ? `<div class="podium">${top.map((r, i) => `<div class="prow">
        <div class="rank">${ordinal(i + 1)}</div>
        <div class="row"><div class="num">${r.profile.number ?? initials(r.profile)}</div><span class="ellipsis" style="font-weight:600">${esc(fullName(r.profile))}</span></div>
        <div class="bar"><i style="width:${Math.round((r.goals / max) * 100)}%"></i></div>
        <div class="val">${r.goals}</div>
      </div>`).join("")}</div>` : `<div class="empty">Pas encore de but cette saison.</div>`}
    </div>
    <div class="card flush">
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Joueur</th><th>M</th><th>B</th><th>PD</th><th>Min</th><th>Entr.</th></tr></thead>
        <tbody>${rows.map((r) => `<tr class="${r.profile.id === me.id ? "us" : ""}">
          <td>${r.profile.number ?? "—"}</td><td>${esc(fullName(r.profile))}</td>
          <td>${r.matches}</td><td class="pts">${r.goals}</td><td>${r.assists}</td><td>${r.minutes}</td><td>${r.trainings}/${r.trainingsTotal}</td>
        </tr>`).join("")}</tbody>
      </table></div>
    </div>
    <p class="small muted" style="margin-top:6px">M = matchs, B = buts, PD = passes décisives, Entr. = présences aux entraînements passés. Les buts et passes sont saisis par l'entraîneur après chaque match.</p>
  `;
}

// ---------- profil ----------
function renderProfile(me) {
  const st = me.role === "player" ? store.stats(me.team_ids[0]).find((r) => r.profile.id === me.id) : null;
  return `
    <h2 class="screen-title">Profil</h2>
    <div class="card hero">
      <div class="watermark">${me.number ?? initials(me)}</div>
      <div class="row" style="gap:6px;margin-bottom:12px"><span class="chip">${me.role === "coach" ? "Entraîneur" : esc(me.position || "Joueur")}</span>${me.team_ids.map((t) => `<span class="chip">${esc(store.team(t).short)}</span>`).join("")}</div>
      <div style="font-family:var(--f-display);font-weight:800;font-size:30px;letter-spacing:-.03em;line-height:1">${esc(me.first)}<br>${esc(me.last)}</div>
      <div class="muted" style="margin-top:6px;font-size:13.5px">${me.team_ids.map((t) => store.team(t).name).join(" · ")}</div>
      ${st ? `<div class="stats">
        <div class="stat"><b>${st.matches}</b><span>matchs</span></div>
        <div class="stat"><b>${st.goals}</b><span>buts</span></div>
        <div class="stat"><b>${st.trainings}/${st.trainingsTotal}</b><span>entraînements</span></div>
      </div>` : ""}
    </div>
    <form id="profile-form" class="card">
      <div class="grid-2">
        <div class="field"><label>Prénom</label><input name="first" value="${esc(me.first)}" required></div>
        <div class="field"><label>Nom</label><input name="last" value="${esc(me.last)}" required></div>
      </div>
      ${me.role === "player" ? `
      <div class="grid-2">
        <div class="field"><label>Poste</label>
          <select name="position">${["GB", "DEF", "MIL", "ATT"].map((p) => `<option ${me.position === p ? "selected" : ""}>${p}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Numéro</label><input name="number" type="number" min="1" max="99" value="${me.number ?? ""}"></div>
      </div>` : ""}
      <div class="field"><label>Téléphone (visible par l'entraîneur)</label><input name="phone" type="tel" value="${esc(me.phone || "")}" placeholder="06 …"></div>
      <button class="btn primary block">Enregistrer</button>
    </form>
    <h3 class="section">Effectif</h3>
    ${store.teams().map((t) => `
      <div class="card flush">
        <div class="row between" style="padding:12px 14px 4px"><b>${esc(t.name)}</b><span class="small muted">${store.profiles(t.id).length} membres</span></div>
        ${store.profiles(t.id).map((p) => `<div class="list-row">
          <div class="num">${p.number ?? initials(p)}</div>
          <div class="grow"><div style="font-weight:600">${esc(fullName(p))}</div><div class="small muted">${p.role === "coach" ? "Entraîneur" : esc(p.position)}</div></div>
          ${me.role === "coach" && p.phone ? `<a class="small mono" href="tel:${esc(p.phone)}">${esc(p.phone)}</a>` : ""}
        </div>`).join("")}
      </div>`).join("")}
    <div style="margin-top:20px;display:flex;flex-direction:column;gap:8px">
      <button class="btn block ghost" id="logout">Se déconnecter</button>
      ${store.demo ? `<button class="btn block ghost small" id="reset">Réinitialiser les données de démonstration</button>` : ""}
    </div>
    <p class="small muted" style="text-align:center;margin-top:18px">${esc(CLUB.name)} · v0.2 ${store.demo ? "· mode démo" : ""}</p>
  `;
}

// ---------- formulaire événement (entraîneur) ----------
function openEventSheet(me, existing = null) {
  const e = existing || { team_id: ui.calTeam && me.team_ids.includes(ui.calTeam) ? ui.calTeam : me.team_ids[0], type: "training", date: "", place: "Stade de Savigny", home: true };
  const dateVal = e.date ? e.date.slice(0, 16) : "";
  const teams = me.team_ids.map((id) => store.team(id));
  const sheet = document.createElement("div");
  sheet.className = "sheet-backdrop";
  sheet.innerHTML = `
    <form class="sheet" id="event-form">
      <h2>${existing ? "Modifier" : "Ajouter"} un événement</h2>
      <div class="grid-2">
        <div class="field"><label>Équipe</label><select name="team_id">${teams.map((t) => `<option value="${t.id}" ${e.team_id === t.id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></div>
        <div class="field"><label>Type</label><select name="type"><option value="training" ${e.type === "training" ? "selected" : ""}>Entraînement</option><option value="match" ${e.type === "match" ? "selected" : ""}>Match</option></select></div>
      </div>
      <div class="field"><label>Date et heure</label><input name="date" type="datetime-local" value="${dateVal}" required></div>
      <div class="field"><label>Lieu</label><input name="place" value="${esc(e.place || "")}" required></div>
      <div id="match-fields" ${e.type !== "match" ? "hidden" : ""}>
        <div class="field"><label>Adversaire</label><input name="opponent" value="${esc(e.opponent || "")}"></div>
        <div class="field"><label>Terrain</label><select name="home"><option value="1" ${e.home ? "selected" : ""}>Domicile</option><option value="0" ${!e.home ? "selected" : ""}>Extérieur</option></select></div>
        <div class="grid-2">
          <div class="field"><label>Buts USS</label><input name="score_for" type="number" min="0" value="${e.score_for ?? ""}" placeholder="—"></div>
          <div class="field"><label>Buts adversaire</label><input name="score_against" type="number" min="0" value="${e.score_against ?? ""}" placeholder="—"></div>
        </div>
      </div>
      <div class="field"><label>Note (facultatif)</label><textarea name="note" rows="2">${esc(e.note || "")}</textarea></div>
      <div style="display:flex;gap:8px;margin-top:6px">
        <button type="button" class="btn ghost" id="sheet-cancel">Annuler</button>
        ${existing ? `<button type="button" class="btn danger" id="sheet-delete">Supprimer</button>` : ""}
        <button class="btn primary grow">Enregistrer</button>
      </div>
    </form>`;
  document.body.appendChild(sheet);
  const form = $("#event-form", sheet);
  form.elements.type.onchange = () => { $("#match-fields", sheet).hidden = form.elements.type.value !== "match"; };
  $("#sheet-cancel", sheet).onclick = () => sheet.remove();
  sheet.onclick = (ev) => { if (ev.target === sheet) sheet.remove(); };
  if (existing) $("#sheet-delete", sheet).onclick = async () => {
    if (confirm("Supprimer cet événement ?")) { await store.deleteEvent(existing.id); sheet.remove(); toast("Événement supprimé"); render(); }
  };
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const f = new FormData(form);
    const isMatch = f.get("type") === "match";
    const num = (v) => (v === "" || v == null ? null : Number(v));
    const data = {
      team_id: f.get("team_id"), type: f.get("type"), date: f.get("date"), place: f.get("place").trim(), note: f.get("note").trim() || undefined,
      opponent: isMatch ? f.get("opponent").trim() : undefined, home: isMatch ? f.get("home") === "1" : undefined,
      score_for: isMatch ? num(f.get("score_for")) : undefined, score_against: isMatch ? num(f.get("score_against")) : undefined,
    };
    try {
      if (existing) await store.updateEvent(existing.id, data); else await store.createEvent(data);
      sheet.remove(); toast(existing ? "Modifié" : "Ajouté à l'agenda"); render();
    } catch (err) { alert(err.message); }
  };
}

// ---------- liaisons par écran ----------
function bindScreen(me) {
  document.querySelectorAll("[data-team]").forEach((b) => b.onclick = () => { ui[b.dataset.key] = b.dataset.team || null; render(); });
  document.querySelectorAll("[data-period]").forEach((b) => b.onclick = () => { ui.period = b.dataset.period; render(); });
  document.querySelectorAll("[data-rsvp]").forEach((b) => b.onclick = async () => {
    const id = b.closest("[data-event]").dataset.event;
    const current = store.myStatus(id);
    await store.setAttendance(id, current === b.dataset.rsvp ? null : b.dataset.rsvp);
    render();
  });
  document.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => openEventSheet(me, store.event(b.dataset.edit)));
  const add = $("#add-event"); if (add) add.onclick = () => openEventSheet(me);
  const pf = $("#profile-form"); if (pf) pf.onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(pf);
    const patch = { first: f.get("first").trim(), last: f.get("last").trim(), phone: f.get("phone").trim() };
    if (me.role === "player") { patch.position = f.get("position"); patch.number = f.get("number") ? Number(f.get("number")) : null; }
    await store.updateProfile(patch); toast("Profil enregistré"); render();
  };
  const lo = $("#logout"); if (lo) lo.onclick = async () => { await store.logout(); if (nav.anim) nav.anim.cancel(); nav.anim = null; nav.el = null; nav.bubble = null; render(); };
  const rs = $("#reset"); if (rs) rs.onclick = () => { if (confirm("Remettre les données de démo à zéro ?")) { store.reset(); if (nav.anim) nav.anim.cancel(); nav.anim = null; nav.el = null; nav.bubble = null; render(); } };
}

let toastTimer;
function toast(msg) {
  const t = $("#toast"); if (!t) return;
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

// ---------- démarrage ----------
installLens();
await store.init();
render();
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
