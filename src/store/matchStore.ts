import { create } from 'zustand'
import { GameState, Seat, SeatPlayer, dealHand } from '@/engine/state'
import { Action, apply } from '@/engine/engine'
import { fetchGame, saveGame, subscribeGame } from '@/engine/sync'

interface MatchStore {
  code: string | null
  myId: string | null
  state: GameState | null
  mySeat: Seat | null
  local: boolean
  error: string | null
  unsub: (() => void) | null

  startLocal: () => void
  host: (code: string, players: Record<Seat, SeatPlayer | null>, myId: string) => Promise<void>
  join: (code: string, myId: string) => Promise<void>
  act: (action: Action) => void
  leave: () => void
}

const seatOfId = (s: GameState, id: string): Seat | null => {
  for (const seat of [0, 1, 2, 3] as Seat[]) if (s.players[seat]?.id === id) return seat
  return null
}

let errorTimer: ReturnType<typeof setTimeout> | null = null
function flashError(set: (p: Partial<MatchStore>) => void, msg: string) {
  set({ error: msg })
  if (errorTimer) clearTimeout(errorTimer)
  errorTimer = setTimeout(() => set({ error: null }), 2600)
}

export const useMatch = create<MatchStore>((set, get) => ({
  code: null,
  myId: null,
  state: null,
  mySeat: null,
  local: false,
  error: null,
  unsub: null,

  // Treino local: você controla as 4 mãos (hotseat). Não toca no Supabase.
  startLocal: () => {
    get().unsub?.()
    const me: SeatPlayer = { id: 'local', name: 'Você' }
    const players: Record<Seat, SeatPlayer | null> = {
      0: me,
      1: { id: 'b1', name: 'Rafa' },
      2: { id: 'b2', name: 'Bia' },
      3: { id: 'b3', name: 'Léo' },
    }
    const state = dealHand({ handNumber: 1, dealer: 0, scores: { nos: 0, eles: 0 }, target: 3000, players })
    set({ code: null, myId: 'local', state, mySeat: null, local: true, error: null, unsub: null })
  },

  // Anfitrião: distribui a 1ª mão e grava no Supabase.
  host: async (code, players, myId) => {
    get().unsub?.()
    const state = dealHand({ handNumber: 1, dealer: 0, scores: { nos: 0, eles: 0 }, target: 3000, players })
    set({ code, myId, state, mySeat: seatOfId(state, myId), local: false, error: null })
    await saveGame(code, state)
    const unsub = subscribeGame(code, (incoming) =>
      set({ state: incoming, mySeat: seatOfId(incoming, get().myId!) }),
    )
    set({ unsub })
  },

  // Entrar/voltar: escuta a partida e busca o estado atual (reconexão).
  join: async (code, myId) => {
    get().unsub?.()
    const unsub = subscribeGame(code, (incoming) =>
      set({ state: incoming, mySeat: seatOfId(incoming, get().myId!) }),
    )
    set({ code, myId, local: false, unsub })
    const existing = await fetchGame(code)
    if (existing) set({ state: existing, mySeat: seatOfId(existing, myId) })
  },

  act: (action) => {
    const { state, mySeat, local, code } = get()
    if (!state) return
    const actor = local ? state.turn : mySeat
    if (actor == null) {
      flashError(set, 'Você não está sentado nesta mesa.')
      return
    }
    // nextHand é liberado pelo motor independente da vez
    const res = apply(state, action, actor)
    if (res.error) {
      flashError(set, res.error)
      return
    }
    set({ state: res.state, mySeat: local ? null : seatOfId(res.state, get().myId!) })
    if (!local && code) void saveGame(code, res.state)
  },

  leave: () => {
    get().unsub?.()
    set({ code: null, myId: null, state: null, mySeat: null, local: false, error: null, unsub: null })
  },
}))

if (import.meta.env.DEV) {
  ;(window as unknown as { __match: typeof useMatch }).__match = useMatch
}
