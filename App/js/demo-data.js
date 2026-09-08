// Données factices pour le mode démonstration.
// Elles n'ont aucune valeur réelle : joueurs et scores sont inventés.

const today = new Date();
const d = (offsetDays, h = "20:00") => {
  const x = new Date(today);
  x.setDate(x.getDate() + offsetDays);
  const iso = x.toISOString().slice(0, 10);
  return `${iso}T${h}`;
};

export const teams = [
  { id: "sa",  name: "Seniors A",  short: "SA",  competition: "Départemental 2 — Poule B" },
  { id: "sb",  name: "Seniors B",  short: "SB",  competition: "Départemental 4 — Poule C" },
  { id: "vet", name: "Vétérans",   short: "VET", competition: "Championnat Vétérans" },
  { id: "jeu", name: "Jeunes",     short: "JEU", competition: "U15 — Plateau" },
];

export const profiles = [
  { id: "p1",  first: "Thomas",   last: "Marchand", team_ids: ["sa"],       role: "player", position: "GB",  number: 1 },
  { id: "p2",  first: "Lucas",    last: "Dubois",   team_ids: ["sa"],       role: "player", position: "DEF", number: 4 },
  { id: "p3",  first: "Maxime",   last: "Renaud",   team_ids: ["sa"],       role: "player", position: "DEF", number: 5 },
  { id: "p4",  first: "Hugo",     last: "Petit",    team_ids: ["sa"],       role: "player", position: "MIL", number: 8 },
  { id: "p5",  first: "Nathan",   last: "Girard",   team_ids: ["sa", "sb"], role: "player", position: "MIL", number: 10 },
  { id: "p6",  first: "Enzo",     last: "Lefèvre",  team_ids: ["sa"],       role: "player", position: "ATT", number: 9 },
  { id: "p7",  first: "Léo",      last: "Moreau",   team_ids: ["sa"],       role: "player", position: "ATT", number: 11 },
  { id: "p8",  first: "Antoine",  last: "Fournier", team_ids: ["sb"],       role: "player", position: "GB",  number: 16 },
  { id: "p9",  first: "Julien",   last: "Bonnet",   team_ids: ["sb"],       role: "player", position: "DEF", number: 3 },
  { id: "p10", first: "Romain",   last: "Chevalier",team_ids: ["sb"],       role: "player", position: "MIL", number: 6 },
  { id: "p11", first: "Kevin",    last: "Roussel",  team_ids: ["sb"],       role: "player", position: "ATT", number: 7 },
  { id: "p12", first: "Pascal",   last: "Meunier",  team_ids: ["vet"],      role: "player", position: "DEF", number: 2 },
  { id: "p13", first: "Olivier",  last: "Garnier",  team_ids: ["vet"],      role: "player", position: "MIL", number: 14 },
  { id: "p14", first: "Noah",     last: "Barbier",  team_ids: ["jeu"],      role: "player", position: "ATT", number: 9 },
  { id: "c1",  first: "Stéphane", last: "Vidal",    team_ids: ["sa", "sb"], role: "coach",  position: "",    number: null },
  { id: "c2",  first: "Franck",   last: "Lambert",  team_ids: ["vet"],      role: "coach",  position: "",    number: null },
  { id: "c3",  first: "Camille",  last: "Perrin",   team_ids: ["jeu"],      role: "coach",  position: "",    number: null },
];

export const events = [
  // Passés
  { id: "e1", team_id: "sa",  type: "match",    date: d(-9, "15:00"), place: "Stade de Savigny",   opponent: "AS Beaune",         home: true,  score_for: 2, score_against: 1 },
  { id: "e2", team_id: "sa",  type: "training", date: d(-5, "19:30"), place: "Stade de Savigny" },
  { id: "e3", team_id: "sa",  type: "match",    date: d(-2, "15:00"), place: "Stade de Nuits",     opponent: "FC Nuits-St-Georges", home: false, score_for: 1, score_against: 1 },
  { id: "e4", team_id: "sb",  type: "match",    date: d(-2, "13:00"), place: "Stade de Savigny",   opponent: "US Meursault B",     home: true,  score_for: 0, score_against: 3 },
  // À venir
  { id: "e5", team_id: "sa",  type: "training", date: d(1, "19:30"),  place: "Stade de Savigny",   note: "Séance physique + jeu réduit" },
  { id: "e6", team_id: "sb",  type: "training", date: d(1, "19:30"),  place: "Stade de Savigny" },
  { id: "e7", team_id: "sa",  type: "training", date: d(3, "19:30"),  place: "Stade de Savigny" },
  { id: "e8", team_id: "sa",  type: "match",    date: d(5, "15:00"),  place: "Stade de Savigny",   opponent: "ES Chagny",          home: true },
  { id: "e9", team_id: "sb",  type: "match",    date: d(5, "13:00"),  place: "Stade de Ladoix",    opponent: "AS Ladoix-Serrigny", home: false },
  { id: "e10", team_id: "vet", type: "match",   date: d(6, "10:00"),  place: "Stade de Savigny",   opponent: "Vétérans Beaune",    home: true },
  { id: "e11", team_id: "jeu", type: "training",date: d(2, "18:00"),  place: "Stade de Savigny" },
  { id: "e12", team_id: "jeu", type: "match",   date: d(6, "10:30"),  place: "Stade de Pommard",   opponent: "Plateau U15",        home: false },
];

export const attendance = {
  e5: { p1: "yes", p2: "yes", p3: "maybe", p4: "yes", p5: "no", p6: "yes" },
  e7: { p1: "yes", p4: "yes" },
  e8: { p1: "yes", p2: "yes", p3: "yes", p4: "yes", p6: "yes", p7: "maybe" },
  e6: { p8: "yes", p9: "yes", p10: "maybe" },
  e9: { p8: "yes", p11: "yes" },
};

export const standings = {
  sa: [
    { club: "AS Beaune",             j: 6, g: 4, n: 1, p: 1, bp: 14, bc: 6 },
    { club: "FC Nuits-St-Georges",   j: 6, g: 4, n: 1, p: 1, bp: 11, bc: 7 },
    { club: "USS", us: true,         j: 6, g: 3, n: 2, p: 1, bp: 10, bc: 7 },
    { club: "ES Chagny",             j: 6, g: 3, n: 0, p: 3, bp: 9,  bc: 9 },
    { club: "US Meursault",          j: 6, g: 2, n: 2, p: 2, bp: 8,  bc: 8 },
    { club: "AS Ladoix-Serrigny",    j: 6, g: 1, n: 2, p: 3, bp: 6,  bc: 11 },
    { club: "FC Pommard",            j: 6, g: 1, n: 1, p: 4, bp: 5,  bc: 12 },
    { club: "AS Corgoloin",          j: 6, g: 0, n: 3, p: 3, bp: 4,  bc: 10 },
  ],
  sb: [
    { club: "US Meursault B",        j: 5, g: 4, n: 0, p: 1, bp: 13, bc: 4 },
    { club: "AS Ladoix-Serrigny B",  j: 5, g: 3, n: 1, p: 1, bp: 9,  bc: 5 },
    { club: "ES Chagny B",           j: 5, g: 2, n: 1, p: 2, bp: 7,  bc: 8 },
    { club: "USS B", us: true,       j: 5, g: 1, n: 1, p: 3, bp: 5,  bc: 11 },
    { club: "FC Pommard B",          j: 5, g: 0, n: 1, p: 4, bp: 3,  bc: 9 },
  ],
  vet: [
    { club: "Vétérans Beaune",       j: 3, g: 2, n: 1, p: 0, bp: 7, bc: 3 },
    { club: "USS Vétérans", us: true,j: 3, g: 2, n: 0, p: 1, bp: 6, bc: 4 },
    { club: "Vétérans Nuits",        j: 3, g: 0, n: 1, p: 2, bp: 2, bc: 8 },
  ],
  jeu: [],
};

export const match_stats = [
  { event_id: "e1", profile_id: "p6", goals: 1, assists: 0, minutes: 90 },
  { event_id: "e1", profile_id: "p7", goals: 1, assists: 1, minutes: 75 },
  { event_id: "e1", profile_id: "p5", goals: 0, assists: 1, minutes: 90 },
  { event_id: "e3", profile_id: "p6", goals: 1, assists: 0, minutes: 90 },
  { event_id: "e3", profile_id: "p4", goals: 0, assists: 1, minutes: 90 },
  { event_id: "e4", profile_id: "p11", goals: 0, assists: 0, minutes: 90 },
];
