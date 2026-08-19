import { supabase } from '@/lib/supabase'
import { GameState } from './state'

/**
 * Sincronização via REST/HTTPS (polling) — SEM WebSocket.
 * Funciona em qualquer rede que abra site normal (Wi-Fi de empresa, iCloud Private Relay etc.).
 */

// ---------- Diagnóstico / saúde do backend ----------

/** Por que o backend não está utilizável — muda a orientação que damos ao jogador. */
export type HealthReason = 'no-backend' | 'missing-tables' | 'offline'

export interface Health {
  ok: boolean
  missing: string[] // tabelas que não respondem
  message?: string // mensagem crua do primeiro erro (diagnóstico)
  reason?: HealthReason
}

/**
 * O projeto Supabase no plano grátis HIBERNA após ~7 dias sem uso: aí as chamadas
 * falham por rede, não por tabela faltando. Confundir os dois casos manda o jogador
 * pro conserto errado, então classificamos o erro.
 */
function classify(message: string): HealthReason {
  if (/does not exist|schema cache|PGRST205|42P01|relation/i.test(message)) return 'missing-tables'
  return 'offline' // falha de rede/503: projeto hibernando, fora do ar ou sem internet
}

/**
 * Confere se as 3 tabelas existem e respondem. É o que separa "ao vivo" de verdade
 * de "cada um sozinho na sala".
 */
export async function healthCheck(): Promise<Health> {
  if (!supabase)
    return {
      ok: false,
      missing: ['room_players', 'events', 'games'],
      message: 'sem backend (.env não configurado)',
      reason: 'no-backend',
    }
  const tables = ['room_players', 'events', 'games']
  const missing: string[] = []
  let message: string | undefined
  for (const t of tables) {
    const { error } = await supabase.from(t).select('code', { head: true }).limit(1)
    if (error) {
      missing.push(t)
      message = message ?? error.message
    }
  }
  return {
    ok: missing.length === 0,
    missing,
    message,
    reason: message ? classify(message) : undefined,
  }
}

// ---------- Partida (tabela `games`) ----------

export async function fetchGame(code: string): Promise<GameState | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('games').select('state').eq('code', code).maybeSingle()
  if (error) {
    console.warn('[sync] fetchGame', error.message)
    return null
  }
  return (data?.state as GameState) ?? null
}

export async function saveGame(code: string, state: GameState): Promise<string | null> {
  if (!supabase) return 'sem-backend'
  const { error } = await supabase
    .from('games')
    .upsert({ code, state, updated_at: new Date().toISOString() })
  if (error) {
    console.warn('[sync] saveGame', error.message)
    return error.message
  }
  return null
}

// ---------- Sala / presença (tabela `room_players`) ----------

export interface RoomPlayerRow {
  id: string
  name: string
  seat: number | null
  last_seen: string
}

/** "Bate o ponto": registra/atualiza minha presença e meu assento. */
export async function heartbeat(
  code: string,
  player: { id: string; name: string; seat: number | null },
): Promise<string | null> {
  if (!supabase) return 'sem-backend'
  const { error } = await supabase
    .from('room_players')
    .upsert(
      { code, id: player.id, name: player.name, seat: player.seat, last_seen: new Date().toISOString() },
      { onConflict: 'code,id' },
    )
  return error ? error.message : null
}

/** Quem está presente (visto nos últimos ~12s). Reporta erro em vez de escondê-lo. */
export async function fetchRoomPlayers(
  code: string,
): Promise<{ rows: RoomPlayerRow[]; error: string | null }> {
  if (!supabase) return { rows: [], error: 'sem-backend' }
  const since = new Date(Date.now() - 12000).toISOString()
  const { data, error } = await supabase
    .from('room_players')
    .select('id,name,seat,last_seen')
    .eq('code', code)
    .gte('last_seen', since)
  if (error) {
    console.warn('[sync] fetchRoomPlayers', error.message)
    return { rows: [], error: error.message }
  }
  return { rows: (data as RoomPlayerRow[]) ?? [], error: null }
}

export async function leaveRoom(code: string, id: string): Promise<void> {
  if (!supabase) return
  await supabase.from('room_players').delete().eq('code', code).eq('id', id)
}

// ---------- Eventos sociais (tabela `events`) ----------

export interface EventRow {
  id: number
  kind: string
  payload: { name?: string; emoji?: string } | null
}

export async function sendEvent(
  code: string,
  kind: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!supabase) return
  await supabase.from('events').insert({ code, kind, payload })
}

/** Eventos novos (id > cursor). Retorna lista e o novo cursor. */
export async function fetchEvents(code: string, afterId: number): Promise<EventRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('events')
    .select('id,kind,payload')
    .eq('code', code)
    .gt('id', afterId)
    .order('id', { ascending: true })
    .limit(20)
  if (error) return []
  return (data as EventRow[]) ?? []
}

/** Maior id atual (cursor inicial — pra não repetir eventos antigos). */
export async function latestEventId(code: string): Promise<number> {
  if (!supabase) return 0
  const { data } = await supabase
    .from('events')
    .select('id')
    .eq('code', code)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.id as number) ?? 0
}
