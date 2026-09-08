// ============================================================
// USS — Application
// Routeur d'écrans + rendu. Aucune dépendance externe.
// ============================================================
import { CLUB } from "./config.js";
import { store } from "./store.js";

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const initials = (p) => `${p.first?.[0] || ""}${p.last?.[0] || ""}`.toUpperCase();
const fullName = (p) => `${p.first} ${p.last}`;
const nowIso = () => new Date().toISOString();

const MONTHS = ["jan", "fév", "mar", "avr", "mai", "juin", "juil", "août", "sep", "oct", "nov", "déc"];
const DAYS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
function fmt(dateStr) {
  const dt = new Date(dateStr);
  return {
    day: dt.getDate(),
    month: MONTHS[dt.getMonth()],
    dow: DAYS[dt.getDay()],
    time: dt.toTimeString().slice(0, 5),
    long: dt.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
  };
}

// ---------- état UI ----------
const ui = {
  screen: "home",
  teamFilter: null, // id d'équipe pour calendrier / classement / stats
};

// ---------- icônes ----------
const ICONS = {
  home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  table: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
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
function render() {
  const app = $("#app");
  const me = store.me();
  if (!me) { app.innerHTML = renderAuth(); bindAuth(); return; }

  const screens = { home: renderHome, calendar: renderCalendar, table: renderTable, stats: renderStats, profile: renderProfile };
  app.innerHTML = `
    <header class="top">
      <div class="top-row">
        <div>
          <h1 class="wordmark">US <em>Savigny</em></h1>
          <div class="top-sub">${esc(CLUB.short)} · saison ${esc(CLUB.season)}</div>
        </div>
        <div class="crest" title="${esc(CLUB.name)}">${esc(CLUB.short)}</div>
      </div>
    </header>
    <main>${screens[ui.screen](me)}</main>
    <nav class="tabs">
      ${TABS.map((t) => `<button data-tab="${t.id}" class="${ui.screen === t.id ? "on" : ""}">${ICONS[t.icon]}${t.label}</button>`).join("")}
    </nav>
    <div class="toast" id="toast"></div>
  `;
  app.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => { ui.screen = b.dataset.tab; window.scrollTo(0, 0); render(); });
  bindScreen(me);
}

// ---------- auth ----------
function renderAuth() {
  const demo = store.demo
    ? `
      <div class="notice">Mode démonstration : la connexion par mot de passe s'activera une fois la base de données branchée. Choisis un profil pour tester l'app.</div>
      <h3 class="section">Entrer comme…</h3>
      <div class="demo-list">
        ${store.profiles().map((p) => `
          <button data-demo="${p.id}">
            <span><b>${esc(fullName(p))}</b><br><span class="small muted">${p.team_ids.map((t) => store.team(t).name).join(", ")}</span></span>
            <span class="chip ${p.role === "coach" ? "coach" : ""}">${p.role === "coach" ? "Entraîneur" : "Joueur"}</span>
          </button>`).join("")}
      </div>`
    : "";
  return `
    <main class="auth">
      <div class="crest">${esc(CLUB.short)}</div>
      <h1>Union Sportive<br>Savigny-lès-Beaune</h1>
      <div class="top-sub">${esc(CLUB.postcode)} · saison ${esc(CLUB.season)}</div>
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
  document.querySelectorAll("[data-demo]").forEach((b) => b.onclick = async () => { await store.demoLogin(b.dataset.demo); ui.screen = "home"; render(); });
  $("#login").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try { await store.login(f.get("email"), f.get("password")); render(); }
    catch (err) { $("#login-error").textContent = err.message; }
  };
}

// ---------- accueil ----------
function renderHome(me) {
  const upcoming = store.events(me.team_ids).filter((e) => e.date >= nowIso());
  const next = upcoming[0];
  const lastMatches = store.events(me.team_ids).filter((e) => e.type === "match" && e.score_for != null).slice(-3).reverse();
  const pending = upcoming.filter((e) => !store.myStatus(e.id) && me.role === "player").length;
  const hello = new Date().getHours() < 18 ? "Bonjour" : "Bonsoir";

  return `
    <h2 class="screen-title">${hello}, ${esc(me.first)}</h2>
    ${pending ? `<div class="notice">Tu n'as pas encore répondu à <b>${pending}</b> convocation${pending > 1 ? "s" : ""}. Va dans l'agenda pour indiquer ta présence.</div>` : ""}
    <h3 class="section">Prochain rendez-vous</h3>
    ${next ? eventCard(next, me, { hero: true }) : `<div class="card empty">Rien de prévu pour le moment.</div>`}
    <h3 class="section">Derniers résultats</h3>
    ${lastMatches.length ? lastMatches.map((e) => resultCard(e)).join("") : `<div class="card empty">Pas encore de match joué.</div>`}
    <h3 class="section">Mes équipes</h3>
    ${me.team_ids.map((tid) => {
      const t = store.team(tid);
      const rows = store.standings(tid);
      const pos = rows.findIndex((r) => r.us) + 1;
      return `<div class="card row between">
        <div><b>${esc(t.name)}</b><div class="small muted">${esc(t.competition)}</div></div>
        <div class="mono">${pos ? `${pos}<sup>${pos === 1 ? "er" : "e"}</sup> / ${rows.length}` : "—"}</div>
      </div>`;
    }).join("")}
  `;
}

// ---------- cartes ----------
function eventCard(e, me, { hero = false, showTeam = true } = {}) {
  const f = fmt(e.date);
  const t = store.team(e.team_id);
  const att = store.attendance(e.id);
  const mine = store.myStatus(e.id);
  const counts = { yes: 0, maybe: 0, no: 0 };
  Object.values(att).forEach((s) => counts[s]++);
  const isPlayer = me.team_ids.includes(e.team_id) && me.role === "player";
  const coach = store.isCoachOf(e.team_id);
  const title = e.type === "match" ? `${e.home ? "USS" : esc(e.opponent)} – ${e.home ? esc(e.opponent) : "USS"}` : "Entraînement";
  const played = e.type === "match" && e.score_for != null;

  return `
    <div class="card ${hero ? "hero" : ""}" data-event="${e.id}">
      <div class="row">
        <div class="date-block"><b>${f.day}</b><span>${f.month}</span></div>
        <div class="grow">
          <div class="row" style="gap:6px;margin-bottom:3px">
            <span class="chip ${e.type}">${e.type === "match" ? "Match" : "Entraînement"}</span>
            ${showTeam ? `<span class="chip">${esc(t.short)}</span>` : ""}
          </div>
          <div class="event-title ellipsis">${title}</div>
          <div class="small muted">${f.dow}. ${f.time} · ${esc(e.place)}${e.type === "match" ? (e.home ? " · domicile" : " · extérieur") : ""}</div>
          ${e.note ? `<div class="small" style="margin-top:4px">${esc(e.note)}</div>` : ""}
        </div>
        ${played ? `<div class="score ${e.score_for > e.score_against ? "win" : e.score_for < e.score_against ? "loss" : "draw"}">${e.score_for}–${e.score_against}</div>` : ""}
        ${coach ? `<button class="btn sm ghost" data-edit="${e.id}">Modifier</button>` : ""}
      </div>
      ${isPlayer && !played ? `
        <div class="rsvp">
          <button class="yes ${mine === "yes" ? "on" : ""}" data-rsvp="yes">Présent</button>
          <button class="maybe ${mine === "maybe" ? "on" : ""}" data-rsvp="maybe">Incertain</button>
          <button class="no ${mine === "no" ? "on" : ""}" data-rsvp="no">Absent</button>
        </div>` : ""}
      ${!played ? `
        <div class="counts"><span><b>${counts.yes}</b> présents</span><span><b>${counts.maybe}</b> incertains</span><span><b>${counts.no}</b> absents</span></div>
        <div class="avatars">${store.profiles(e.team_id).filter((p) => p.role === "player").map((p) => `<span class="avatar ${att[p.id] || ""}" title="${esc(fullName(p))}">${initials(p)}</span>`).join("")}</div>` : ""}
    </div>`;
}
function resultCard(e) {
  const f = fmt(e.date);
  const t = store.team(e.team_id);
  const cls = e.score_for > e.score_against ? "win" : e.score_for < e.score_against ? "loss" : "draw";
  return `<div class="card row between">
    <div class="grow">
      <div class="row" style="gap:6px;margin-bottom:2px"><span class="chip">${esc(t.short)}</span><span class="small muted">${f.day} ${f.month}</span></div>
      <div class="event-title ellipsis">${e.home ? "USS" : esc(e.opponent)} – ${e.home ? esc(e.opponent) : "USS"}</div>
    </div>
    <div class="score ${cls}">${e.score_for}–${e.score_against}</div>
  </div>`;
}

// ---------- agenda ----------
function teamPills(me, allowAll = true) {
  const ids = me.role === "coach" ? store.teams().map((t) => t.id) : store.teams().map((t) => t.id);
  if (ui.teamFilter && !ids.includes(ui.teamFilter)) ui.teamFilter = null;
  if (!allowAll && !ui.teamFilter) ui.teamFilter = me.team_ids[0] || ids[0];
  return `<div class="pills">
    ${allowAll ? `<button class="pill ${!ui.teamFilter ? "on" : ""}" data-team="">Mes équipes</button>` : ""}
    ${ids.map((id) => `<button class="pill ${ui.teamFilter === id ? "on" : ""}" data-team="${id}">${esc(store.team(id).short)}</button>`).join("")}
  </div>`;
}
function renderCalendar(me) {
  const teamIds = ui.teamFilter ? [ui.teamFilter] : me.team_ids;
  const all = store.events(teamIds);
  const now = nowIso();
  const upcoming = all.filter((e) => e.date >= now);
  const past = all.filter((e) => e.date < now).reverse();
  const canAdd = me.role === "coach";
  return `
    <h2 class="screen-title">Agenda</h2>
    ${teamPills(me)}
    <h3 class="section">À venir</h3>
    ${upcoming.length ? upcoming.map((e) => eventCard(e, me)).join("") : `<div class="card empty">Aucun événement à venir.</div>`}
    <h3 class="section">Passés</h3>
    ${past.length ? past.map((e) => eventCard(e, me)).join("") : `<div class="card empty">Rien pour l'instant.</div>`}
    ${canAdd ? `<button class="fab" id="add-event" title="Ajouter une séance ou un match">+</button>` : ""}
  `;
}

// ---------- classement ----------
function renderTable(me) {
  const tid = ui.teamFilter || me.team_ids[0];
  const t = store.team(tid);
  const rows = store.standings(tid);
  return `
    <h2 class="screen-title">Classement</h2>
    ${teamPills(me, false)}
    <div class="small muted" style="margin-bottom:10px">${esc(t.competition)}</div>
    ${rows.length ? `
    <div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Club</th><th>Pts</th><th>J</th><th>G</th><th>N</th><th>P</th><th>Diff</th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr class="${r.us ? "us" : ""}"><td class="mono">${i + 1}</td><td>${esc(r.club)}</td><td class="pts">${r.pts}</td><td>${r.j}</td><td>${r.g}</td><td>${r.n}</td><td>${r.p}</td><td class="mono">${r.diff > 0 ? "+" : ""}${r.diff}</td></tr>`).join("")}</tbody>
    </table></div>` : `<div class="card empty">Pas de classement pour cette équipe (plateau ou compétition sans classement).</div>`}
    <h3 class="section">Calendrier des matchs</h3>
    ${store.events([tid]).filter((e) => e.type === "match").map((e) => e.score_for != null ? resultCard(e) : eventCard(e, me, { showTeam: false })).join("") || `<div class="card empty">Aucun match programmé.</div>`}
  `;
}

// ---------- stats ----------
function renderStats(me) {
  const tid = ui.teamFilter || me.team_ids[0];
  const rows = store.stats(tid);
  const totals = rows.reduce((a, r) => ({ goals: a.goals + r.goals, assists: a.assists + r.assists }), { goals: 0, assists: 0 });
  const matches = store.events([tid]).filter((e) => e.type === "match" && e.score_for != null);
  const w = matches.filter((e) => e.score_for > e.score_against).length;
  const n = matches.filter((e) => e.score_for === e.score_against).length;
  const l = matches.length - w - n;
  return `
    <h2 class="screen-title">Statistiques</h2>
    ${teamPills(me, false)}
    <div class="stats">
      <div class="stat"><b>${matches.length}</b><span>matchs</span></div>
      <div class="stat"><b>${w}-${n}-${l}</b><span>V-N-D</span></div>
      <div class="stat"><b>${totals.goals}</b><span>buts</span></div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Joueur</th><th>M</th><th>Buts</th><th>Passes</th><th>Min</th><th>Entr.</th></tr></thead>
      <tbody>${rows.map((r) => `<tr class="${r.profile.id === me.id ? "us" : ""}">
        <td class="mono">${r.profile.number ?? "—"}</td><td>${esc(fullName(r.profile))}</td>
        <td>${r.matches}</td><td class="pts">${r.goals}</td><td>${r.assists}</td><td>${r.minutes}</td><td class="mono">${r.trainings}/${r.trainingsTotal}</td>
      </tr>`).join("")}</tbody>
    </table></div>
    <p class="small muted" style="margin-top:10px">Entr. = présences confirmées aux entraînements passés. Les buts et passes sont saisis par l'entraîneur après chaque match.</p>
  `;
}

// ---------- profil ----------
function renderProfile(me) {
  const teams = store.teams();
  return `
    <h2 class="screen-title">Mon profil</h2>
    <div class="card row">
      <div class="num" style="width:48px;height:48px;font-size:20px">${me.number ?? initials(me)}</div>
      <div class="grow">
        <div class="event-title">${esc(fullName(me))}</div>
        <div class="small muted">${me.role === "coach" ? "Entraîneur" : esc(me.position || "Joueur")} · ${me.team_ids.map((t) => store.team(t).name).join(", ")}</div>
      </div>
      <span class="chip ${me.role === "coach" ? "coach" : ""}">${me.role === "coach" ? "Coach" : "Joueur"}</span>
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
    ${teams.map((t) => `
      <div class="card">
        <div class="row between" style="margin-bottom:6px"><b>${esc(t.name)}</b><span class="small muted">${store.profiles(t.id).length} membres</span></div>
        ${store.profiles(t.id).map((p) => `<div class="list-row">
          <div class="num">${p.number ?? initials(p)}</div>
          <div class="grow"><div>${esc(fullName(p))}</div><div class="small muted">${p.role === "coach" ? "Entraîneur" : esc(p.position)}</div></div>
          ${me.role === "coach" && p.phone ? `<a class="small mono" href="tel:${esc(p.phone)}">${esc(p.phone)}</a>` : ""}
        </div>`).join("")}
      </div>`).join("")}
    <div style="margin-top:20px;display:flex;flex-direction:column;gap:8px">
      <button class="btn block" id="logout">Se déconnecter</button>
      ${store.demo ? `<button class="btn block ghost small" id="reset">Réinitialiser les données de démonstration</button>` : ""}
    </div>
    <p class="small muted" style="text-align:center;margin-top:18px">${esc(CLUB.name)} · v0.1 ${store.demo ? "· mode démo" : ""}</p>
  `;
}

// ---------- formulaire événement (entraîneur) ----------
function openEventSheet(me, existing = null) {
  const e = existing || { team_id: ui.teamFilter || me.team_ids[0], type: "training", date: "", place: "Stade de Savigny", home: true };
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
  document.querySelectorAll("[data-team]").forEach((b) => b.onclick = () => { ui.teamFilter = b.dataset.team || null; render(); });
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
  const lo = $("#logout"); if (lo) lo.onclick = async () => { await store.logout(); render(); };
  const rs = $("#reset"); if (rs) rs.onclick = () => { if (confirm("Remettre les données de démo à zéro ?")) { store.reset(); render(); } };
}

let toastTimer;
function toast(msg) {
  const t = $("#toast"); if (!t) return;
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

// ---------- démarrage ----------
await store.init();
render();
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
