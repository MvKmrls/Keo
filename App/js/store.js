// ============================================================
// USS — Couche de données
// Toute l'app passe par cette interface asynchrone. Aujourd'hui
// elle est servie par le mode démo (localStorage). Le jour où
// Supabase est branché, seule cette couche change.
// ============================================================
import { DEMO_MODE } from "./config.js";
import * as demo from "./demo-data.js";

const KEY = "uss-demo-v1";
let state = null;
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  listeners.forEach((fn) => fn());
}
function fresh() {
  return {
    session: null,
    teams: structuredClone(demo.teams),
    profiles: structuredClone(demo.profiles),
    events: structuredClone(demo.events),
    attendance: structuredClone(demo.attendance),
    standings: structuredClone(demo.standings),
    match_stats: structuredClone(demo.match_stats),
  };
}
const uid = () => Math.random().toString(36).slice(2, 10);

export const store = {
  demo: DEMO_MODE,

  async init() {
    state = load() || fresh();
    return state;
  },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  reset() { state = fresh(); save(); },

  // ---- session ----
  me() {
    if (!state.session) return null;
    return state.profiles.find((p) => p.id === state.session) || null;
  },
  isCoachOf(teamId) {
    const me = this.me();
    return !!me && me.role === "coach" && (!teamId || me.team_ids.includes(teamId));
  },
  async demoLogin(profileId) { state.session = profileId; save(); },
  async login(/* email, password */) {
    throw new Error("La connexion par mot de passe sera disponible une fois Supabase branché.");
  },
  async logout() { state.session = null; save(); },

  // ---- lecture ----
  teams() { return state.teams; },
  team(id) { return state.teams.find((t) => t.id === id); },
  profiles(teamId) {
    return state.profiles
      .filter((p) => !teamId || p.team_ids.includes(teamId))
      .sort((a, b) => (a.role === b.role ? (a.number ?? 99) - (b.number ?? 99) : a.role === "coach" ? -1 : 1));
  },
  profile(id) { return state.profiles.find((p) => p.id === id); },
  events(teamIds) {
    return state.events
      .filter((e) => !teamIds || teamIds.includes(e.team_id))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
  event(id) { return state.events.find((e) => e.id === id); },
  attendance(eventId) { return state.attendance[eventId] || {}; },
  myStatus(eventId) {
    const me = this.me();
    return me ? this.attendance(eventId)[me.id] || null : null;
  },
  standings(teamId) {
    const rows = (state.standings[teamId] || []).map((r) => ({ ...r, pts: r.g * 3 + r.n, diff: r.bp - r.bc }));
    return rows.sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.bp - a.bp);
  },
  stats(teamId) {
    const players = this.profiles(teamId).filter((p) => p.role === "player");
    const matches = this.events(teamId ? [teamId] : null).filter((e) => e.type === "match" && e.score_for != null);
    const trainings = this.events(teamId ? [teamId] : null).filter((e) => e.type === "training" && e.date < new Date().toISOString());
    return players.map((p) => {
      const rows = state.match_stats.filter((s) => s.profile_id === p.id && matches.some((m) => m.id === s.event_id));
      const present = trainings.filter((t) => (state.attendance[t.id] || {})[p.id] === "yes").length;
      return {
        profile: p,
        matches: rows.length,
        goals: rows.reduce((n, r) => n + (r.goals || 0), 0),
        assists: rows.reduce((n, r) => n + (r.assists || 0), 0),
        minutes: rows.reduce((n, r) => n + (r.minutes || 0), 0),
        trainings: present,
        trainingsTotal: trainings.length,
      };
    }).sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.matches - a.matches);
  },

  // ---- écriture ----
  async setAttendance(eventId, status) {
    const me = this.me();
    if (!me) throw new Error("Non connecté");
    state.attendance[eventId] ||= {};
    if (status) state.attendance[eventId][me.id] = status;
    else delete state.attendance[eventId][me.id];
    save();
  },
  async updateProfile(patch) {
    const me = this.me();
    if (!me) throw new Error("Non connecté");
    Object.assign(me, patch);
    save();
  },
  async createEvent(evt) {
    if (!this.isCoachOf(evt.team_id)) throw new Error("Réservé à l'entraîneur de l'équipe");
    const e = { id: uid(), ...evt };
    state.events.push(e);
    save();
    return e;
  },
  async updateEvent(id, patch) {
    const e = this.event(id);
    if (!e || !this.isCoachOf(e.team_id)) throw new Error("Réservé à l'entraîneur de l'équipe");
    Object.assign(e, patch);
    save();
  },
  async deleteEvent(id) {
    const e = this.event(id);
    if (!e || !this.isCoachOf(e.team_id)) throw new Error("Réservé à l'entraîneur de l'équipe");
    state.events = state.events.filter((x) => x.id !== id);
    delete state.attendance[id];
    state.match_stats = state.match_stats.filter((s) => s.event_id !== id);
    save();
  },
};
