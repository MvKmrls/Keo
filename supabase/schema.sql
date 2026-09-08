-- ============================================================
-- USS — Schéma de base de données (Supabase / PostgreSQL)
-- À exécuter dans l'éditeur SQL de Supabase une fois le projet créé.
-- Les règles RLS en bas définissent qui peut faire quoi :
--   - tout membre connecté lit le club entier ;
--   - un joueur ne modifie que son profil et ses propres présences ;
--   - un entraîneur gère les événements, scores et stats de ses équipes.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Équipes ----------
create table if not exists teams (
  id          text primary key,            -- 'sa', 'sb', 'vet', 'jeu'
  name        text not null,
  short       text not null,
  competition text,
  sort_order  int  not null default 0
);

insert into teams (id, name, short, competition, sort_order) values
  ('sa',  'Seniors A', 'SA',  null, 1),
  ('sb',  'Seniors B', 'SB',  null, 2),
  ('vet', 'Vétérans',  'VET', null, 3),
  ('jeu', 'Jeunes',    'JEU', null, 4)
on conflict (id) do nothing;

-- ---------- Profils (1 ligne par compte auth) ----------
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name  text not null default '',
  role       text not null default 'player' check (role in ('player', 'coach', 'admin')),
  position   text check (position in ('GB', 'DEF', 'MIL', 'ATT')),
  number     int  check (number between 1 and 99),
  phone      text,
  created_at timestamptz not null default now()
);

-- Appartenance aux équipes (un joueur peut être en A et en B)
create table if not exists team_members (
  team_id    text references teams(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  primary key (team_id, profile_id)
);

-- ---------- Code d'invitation du club ----------
-- Empêche n'importe qui de créer un compte : l'inscription exige ce code.
create table if not exists invite_codes (
  code       text primary key,
  role       text not null default 'player' check (role in ('player', 'coach')),
  team_id    text references teams(id),
  active     boolean not null default true
);

-- Crée automatiquement le profil à l'inscription.
-- Le code d'invitation et les infos sont passés dans user_metadata côté app.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  inv  invite_codes%rowtype;
begin
  select * into inv from invite_codes where code = meta->>'invite_code' and active;
  if inv.code is null then
    raise exception 'Code d''invitation invalide';
  end if;

  insert into profiles (id, first_name, last_name, role, position, number)
  values (new.id, coalesce(meta->>'first_name', ''), coalesce(meta->>'last_name', ''),
          inv.role, nullif(meta->>'position', ''), nullif(meta->>'number', '')::int);

  if inv.team_id is not null then
    insert into team_members (team_id, profile_id) values (inv.team_id, new.id);
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- ---------- Événements : séances et matchs ----------
create table if not exists events (
  id            uuid primary key default gen_random_uuid(),
  team_id       text not null references teams(id) on delete cascade,
  type          text not null check (type in ('training', 'match')),
  date          timestamptz not null,
  place         text not null default '',
  opponent      text,
  home          boolean,
  score_for     int,
  score_against int,
  note          text,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists events_team_date on events (team_id, date);

-- ---------- Présences ----------
create table if not exists attendance (
  event_id   uuid references events(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  status     text not null check (status in ('yes', 'maybe', 'no')),
  updated_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);

-- ---------- Stats individuelles par match ----------
create table if not exists match_stats (
  event_id   uuid references events(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  goals      int not null default 0,
  assists    int not null default 0,
  minutes    int not null default 0,
  yellow     int not null default 0,
  red        int not null default 0,
  primary key (event_id, profile_id)
);

-- ---------- Classement (saisi par l'entraîneur) ----------
create table if not exists standings (
  team_id text references teams(id) on delete cascade,
  club    text not null,
  is_us   boolean not null default false,
  played  int not null default 0,
  won     int not null default 0,
  drawn   int not null default 0,
  lost    int not null default 0,
  gf      int not null default 0,
  ga      int not null default 0,
  primary key (team_id, club)
);

-- ============================================================
-- Sécurité (Row Level Security)
-- ============================================================
alter table teams        enable row level security;
alter table profiles     enable row level security;
alter table team_members enable row level security;
alter table invite_codes enable row level security;
alter table events       enable row level security;
alter table attendance   enable row level security;
alter table match_stats  enable row level security;
alter table standings    enable row level security;

-- Aide : suis-je entraîneur (ou admin) de cette équipe ?
create or replace function is_coach_of(t text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    join team_members tm on tm.profile_id = p.id
    where p.id = auth.uid() and p.role in ('coach', 'admin') and tm.team_id = t
  ) or exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- Lecture : tout membre connecté voit tout le club.
create policy "read teams"        on teams        for select to authenticated using (true);
create policy "read profiles"     on profiles     for select to authenticated using (true);
create policy "read members"      on team_members for select to authenticated using (true);
create policy "read events"       on events       for select to authenticated using (true);
create policy "read attendance"   on attendance   for select to authenticated using (true);
create policy "read stats"        on match_stats  for select to authenticated using (true);
create policy "read standings"    on standings    for select to authenticated using (true);
-- Les codes d'invitation ne sont jamais lisibles côté client (le trigger y accède en security definer).

-- Profil : chacun modifie le sien (sans changer son rôle).
create policy "update own profile" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));

-- Présences : chacun gère les siennes.
create policy "own attendance insert" on attendance for insert to authenticated with check (profile_id = auth.uid());
create policy "own attendance update" on attendance for update to authenticated using (profile_id = auth.uid());
create policy "own attendance delete" on attendance for delete to authenticated using (profile_id = auth.uid());

-- Événements, stats, classement, effectif : entraîneur de l'équipe.
create policy "coach events"    on events       for all to authenticated using (is_coach_of(team_id)) with check (is_coach_of(team_id));
create policy "coach stats"     on match_stats  for all to authenticated
  using (is_coach_of((select team_id from events where id = event_id)))
  with check (is_coach_of((select team_id from events where id = event_id)));
create policy "coach standings" on standings    for all to authenticated using (is_coach_of(team_id)) with check (is_coach_of(team_id));
create policy "coach members"   on team_members for all to authenticated using (is_coach_of(team_id)) with check (is_coach_of(team_id));
