import { create } from 'zustand'
import { GameState, Seat, SeatPlayer, dealHand } from '@/engine/state'
import { Action, apply } from '@/engine/engine'
import { fetchGame, saveGame } from '@/engine/sync'

export type MatchMode = 'online' | 'hotseat' | 'bots'

interface MatchStore {
  code: string | null
  myId: string | null
  state: GameState | null
  mySeat: Seat | null
  local: boolean // true em hotseat e bots (offline, um aparelho)
  mode: MatchMode
  humanSeat: Seat | null // no modo bots: o assento que a pessoa controla
  bots: Seat[] // assentos jogados pela IA
  error: string | null

  startLocal: () => void
  startBots: () => void
  resumeOffline: () => boolean // retoma jogo offline salvo; false se não houver
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

/**
 * Partida offline sobrevive a recarregar/fechar o app. Sem isto, voltar pro /mesa
 * perdia o jogo contra bots e caía no modo "passa e joga" — a pessoa acabava
 * jogando as 4 mãos sozinha sem entender por quê.
 */
const OFFLINE_KEY = 'tranca.offline'

interface OfflineSave {
  mode: MatchMode
  state: GameState
  humanSeat: Seat | null
  bots: Seat[]
}

const saveOffline = (save: OfflineSave) => {
  try {
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(save))
  } catch {
    /* ignore */
  }
}
const clearOffline = () => {
  try {
    localStorage.removeItem(OFFLINE_KEY)
  } catch {
    /* ignore */
  }
}
const loadOffline = (): OfflineSave | null => {
  try {
    const raw = localStorage.getItem(OFFLINE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as OfflineSave
    return p?.state && p.mode !== 'online' ? p : null
  } catch {
    return null
  }
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
    mode: 'online',
    humanSeat: null,
    bots: [],
    error: null,

    // Hotseat: um aparelho controla as 4 mãos (passa e joga).
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
      set({ code: null, myId: 'local', state, mySeat: null, local: true, mode: 'hotseat', humanSeat: null, bots: [], error: null })
    },

    // Offline vs bots: você (assento 0) contra 3 bots. Zero backend.
    startBots: () => {
      stopPolling()
      const players: Record<Seat, SeatPlayer | null> = {
        0: { id: 'you', name: 'Você' },
        1: { id: 'bot1', name: 'Rafa 🤖' },
        2: { id: 'bot2', name: 'Bia 🤖' },
        3: { id: 'bot3', name: 'Léo 🤖' },
      }
      const state = dealHand({ handNumber: 1, dealer: 3, scores: { nos: 0, eles: 0 }, target: 3000, players })
      set({ code: null, myId: 'you', state, mySeat: 0, local: true, mode: 'bots', humanSeat: 0, bots: [1, 2, 3], error: null })
      saveOffline({ mode: 'bots', state, humanSeat: 0, bots: [1, 2, 3] })
    },

    resumeOffline: () => {
      const save = loadOffline()
      if (!save) return false
      stopPolling()
      set({
        code: null,
        myId: save.mode === 'bots' ? 'you' : 'local',
        state: save.state,
        mySeat: save.humanSeat,
        local: true,
        mode: save.mode,
        humanSeat: save.humanSeat,
        bots: save.bots ?? [],
        error: null,
      })
      return true
    },

    host: async (code, players, myId) => {
      stopPolling()
      const state = dealHand({ handNumber: 1, dealer: 0, scores: { nos: 0, eles: 0 }, target: 3000, players })
      set({ code, myId, state, mySeat: seatOfId(state, myId), local: false, mode: 'online', humanSeat: null, bots: [], error: null })
      await saveGame(code, state)
      startPolling(code, myId)
    },

    join: async (code, myId) => {
      set({ code, myId, local: false, mode: 'online', humanSeat: null, bots: [] })
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
      const { mode, humanSeat, bots } = get()
      const nextMySeat =
        mode === 'online' ? seatOfId(next, get().myId!) : mode === 'bots' ? humanSeat : null
      set({ state: next, mySeat: nextMySeat })
      if (!local && code) void saveGame(code, next)
      if (local) saveOffline({ mode, state: next, humanSeat, bots }) // sobrevive a recarregar
    },

    leave: () => {
      stopPolling()
      clearOffline()
      set({ code: null, myId: null, state: null, mySeat: null, local: false, mode: 'online', humanSeat: null, bots: [], error: null })
    },
  }
})

if (import.meta.env.DEV) {
  ;(window as unknown as { __match: typeof useMatch }).__match = useMatch
}
