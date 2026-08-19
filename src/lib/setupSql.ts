/**
 * SQL de configuração do Supabase (roda uma vez, no SQL Editor).
 * É idempotente — pode rodar quantas vezes quiser sem quebrar nada.
 * Mantido em sincronia com supabase/schema.sql.
 */
export const SETUP_SQL = `-- Tranca Online — cole tudo isto no SQL Editor do Supabase e clique em "Run".
-- Pode rodar mais de uma vez (é idempotente).

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
`

const projectRef = (): string | undefined =>
  ((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '').match(
    /https:\/\/([a-z0-9]+)\.supabase\./,
  )?.[1]

/** Link direto pro SQL Editor do projeto (deriva o ref da URL do Supabase). */
export function sqlEditorUrl(): string {
  const ref = projectRef()
  return ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : 'https://supabase.com/dashboard'
}

/** Painel do projeto — é onde se "acorda" um projeto grátis que hibernou. */
export function dashboardUrl(): string {
  const ref = projectRef()
  return ref ? `https://supabase.com/dashboard/project/${ref}` : 'https://supabase.com/dashboard'
}
