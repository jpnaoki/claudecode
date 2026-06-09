import { supabase } from '@/lib/supabase'
import { GameState } from './state'

/**
 * Sincronização via REST/HTTPS (polling) — SEM WebSocket.
 * Funciona em qualquer rede que abra site normal (Wi-Fi de empresa, iCloud Private Relay etc.).
 */

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

/** Quem está presente (visto nos últimos ~12s). */
export async function fetchRoomPlayers(code: string): Promise<RoomPlayerRow[]> {
  if (!supabase) return []
  const since = new Date(Date.now() - 12000).toISOString()
  const { data, error } = await supabase
    .from('room_players')
    .select('id,name,seat,last_seen')
    .eq('code', code)
    .gte('last_seen', since)
  if (error) {
    console.warn('[sync] fetchRoomPlayers', error.message)
    return []
  }
  return (data as RoomPlayerRow[]) ?? []
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
