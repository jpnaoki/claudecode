import { create } from 'zustand'
import { GameState, Seat, SeatPlayer, dealHand } from '@/engine/state'
import { Action, apply } from '@/engine/engine'
import { fetchGame, saveGame } from '@/engine/sync'

interface MatchStore {
  code: string | null
  myId: string | null
  state: GameState | null
  mySeat: Seat | null
  local: boolean
  error: string | null

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

let pollTimer: ReturnType<typeof setInterval> | null = null
let errorTimer: ReturnType<typeof setTimeout> | null = null
const stopPolling = () => {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

export const useMatch = create<MatchStore>((set, get) => {
  const flashError = (msg: string) => {
    set({ error: msg })
    if (errorTimer) clearTimeout(errorTimer)
    errorTimer = setTimeout(() => set({ error: null }), 2600)
  }

  // Busca a partida em ciclo; aplica só se for mais nova (rev maior).
  const startPolling = (code: string, myId: string) => {
    stopPolling()
    const tick = async () => {
      const incoming = await fetchGame(code)
      if (!incoming) return
      const cur = get().state
      if (!cur || incoming.rev > cur.rev) {
        set({ state: incoming, mySeat: seatOfId(incoming, myId) })
      }
    }
    void tick()
    pollTimer = setInterval(tick, 1500)
  }

  return {
    code: null,
    myId: null,
    state: null,
    mySeat: null,
    local: false,
    error: null,

    startLocal: () => {
      stopPolling()
      const me: SeatPlayer = { id: 'local', name: 'Você' }
      const players: Record<Seat, SeatPlayer | null> = {
        0: me,
        1: { id: 'b1', name: 'Rafa' },
        2: { id: 'b2', name: 'Bia' },
        3: { id: 'b3', name: 'Léo' },
      }
      const state = dealHand({ handNumber: 1, dealer: 0, scores: { nos: 0, eles: 0 }, target: 3000, players })
      set({ code: null, myId: 'local', state, mySeat: null, local: true, error: null })
    },

    host: async (code, players, myId) => {
      stopPolling()
      const state = dealHand({ handNumber: 1, dealer: 0, scores: { nos: 0, eles: 0 }, target: 3000, players })
      set({ code, myId, state, mySeat: seatOfId(state, myId), local: false, error: null })
      await saveGame(code, state)
      startPolling(code, myId)
    },

    join: async (code, myId) => {
      set({ code, myId, local: false })
      startPolling(code, myId)
    },

    act: (action) => {
      const { state, mySeat, local, code } = get()
      if (!state) return
      const actor = local ? state.turn : mySeat
      if (actor == null) {
        flashError('Você não está sentado nesta mesa.')
        return
      }
      const res = apply(state, action, actor)
      if (res.error) {
        flashError(res.error)
        return
      }
      const next = res.state
      next.rev = (state.rev ?? 0) + 1
      set({ state: next, mySeat: local ? null : seatOfId(next, get().myId!) })
      if (!local && code) void saveGame(code, next)
    },

    leave: () => {
      stopPolling()
      set({ code: null, myId: null, state: null, mySeat: null, local: false, error: null })
    },
  }
})

if (import.meta.env.DEV) {
  ;(window as unknown as { __match: typeof useMatch }).__match = useMatch
}
