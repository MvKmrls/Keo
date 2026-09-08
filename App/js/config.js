// ============================================================
// USS — Configuration
// Quand le projet Supabase existe, renseigner les deux valeurs
// ci-dessous. Tant qu'elles sont vides, l'app tourne en mode
// démonstration (données factices, stockées dans le navigateur).
// ============================================================
export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";

export const CLUB = {
  name: "Union Sportive de Savigny-lès-Beaune",
  short: "USS",
  city: "Savigny-lès-Beaune",
  postcode: "21420",
  season: "2026-2027",
};

export const DEMO_MODE = !SUPABASE_URL || !SUPABASE_ANON_KEY;
