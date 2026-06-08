import { supabase } from '@/lib/supabase'
import { GameState } from './state'

/**
 * Persistência + tempo real da partida (tabela `games` no Supabase).
 * Guardar o estado no banco é o que dá a reconexão: ao voltar, lê-se a partida do ponto exato.
 */

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

/** Escuta mudanças da partida em tempo real. Retorna função pra cancelar. */
export function subscribeGame(code: string, cb: (state: GameState) => void): () => void {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`game:${code}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'games', filter: `code=eq.${code}` },
      (payload) => {
        const row = payload.new as { state?: GameState }
        if (row?.state) cb(row.state)
      },
    )
    .subscribe()
  return () => {
    supabase?.removeChannel(channel)
  }
}
