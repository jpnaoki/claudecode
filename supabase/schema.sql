-- Tranca Online — schema do Supabase.
-- Cole TUDO isto no SQL Editor do seu projeto (Dashboard → SQL → New query) e clique em "Run".
-- Pode rodar quantas vezes quiser (é idempotente). Sem isto, cada pessoa fica sozinha na sala.

-- 1) Presença na sala (quem está + em que assento)
create table if not exists public.room_players (
  code       text        not null,
  id         text        not null,
  name       text        not null,
  seat       integer,
  last_seen  timestamptz not null default now(),
  primary key (code, id)
);

-- 2) Eventos sociais (cinzeiro, emotes) — fila incremental por id
create table if not exists public.events (
  id         bigint generated always as identity primary key,
  code       text not null,
  kind       text not null,
  payload    jsonb,
  created_at timestamptz not null default now()
);
create index if not exists events_code_id_idx on public.events (code, id);

-- 3) Estado da partida (um registro por sala)
create table if not exists public.games (
  code       text primary key,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Segurança (RLS): jogo entre amigos, sem dados sensíveis → liberado p/ a chave pública (anon).
alter table public.room_players enable row level security;
alter table public.events       enable row level security;
alter table public.games        enable row level security;

drop policy if exists "tranca anon room_players" on public.room_players;
drop policy if exists "tranca anon events"       on public.events;
drop policy if exists "tranca anon games"        on public.games;

create policy "tranca anon room_players" on public.room_players for all using (true) with check (true);
create policy "tranca anon events"       on public.events       for all using (true) with check (true);
create policy "tranca anon games"        on public.games        for all using (true) with check (true);
