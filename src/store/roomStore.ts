import { create } from 'zustand'
import { Identity } from '@/lib/identity'
import {
  heartbeat,
  fetchRoomPlayers,
  leaveRoom,
  sendEvent,
  fetchEvents,
  latestEventId,
  fetchGame,
} from '@/engine/sync'
import { supabase } from '@/lib/supabase'

export type RoomStatus = 'idle' | 'connecting' | 'connected' | 'no-backend' | 'error'

export interface RoomPlayer {
  id: string
  name: string
  seat: number | null
  joinedAt: number
}

export interface Reaction {
  id: string
  kind: 'smoke' | 'emote'
  emoji?: string
  name: string
  ts: number
}

export const teamOfSeat = (seat: number): 'nos' | 'eles' => (seat % 2 === 0 ? 'nos' : 'eles')

let reactionSeq = 0
let timers: ReturnType<typeof setInterval>[] = []
let eventCursor = 0
let started = false
let mySeatLocal: number | null = null

const clearTimers = () => {
  timers.forEach(clearInterval)
  timers = []
}

interface RoomStore {
  code: string | null
  me: Identity | null
  status: RoomStatus
  players: RoomPlayer[]
  reactions: Reaction[]
  mySeat: number | null
  lastStatus: string | null
  onStart?: () => void

  setOnStart: (fn?: () => void) => void
  connect: (code: string, me: Identity) => void
  disconnect: () => void
  chooseSeat: (seat: number | null) => void
  start: () => void
  sendSmoke: () => void
  sendEmote: (emoji: string) => void
}

export const useRoom = create<RoomStore>((set, get) => {
  const pushReaction = (kind: 'smoke' | 'emote', name: string, emoji?: string) => {
    const reaction: Reaction = { id: `r${reactionSeq++}`, kind, name, emoji, ts: Date.now() }
    set((st) => ({ reactions: [...st.reactions, reaction] }))
    setTimeout(
      () => set((st) => ({ reactions: st.reactions.filter((x) => x.id !== reaction.id) })),
      4000,
    )
  }

  const pollPlayers = async (code: string, me: Identity) => {
    const rows = await fetchRoomPlayers(code)
    const list: RoomPlayer[] = rows
      .map((r) => ({ id: r.id, name: r.name, seat: r.seat, joinedAt: Date.parse(r.last_seen) || 0 }))
      .sort((a, b) => a.name.localeCompare(b.name))
    const mine = list.find((p) => p.id === me.id)
    set({ players: list, status: 'connected', mySeat: mine?.seat ?? mySeatLocal })
  }

  const pollEvents = async (code: string) => {
    const evs = await fetchEvents(code, eventCursor)
    for (const e of evs) {
      eventCursor = Math.max(eventCursor, e.id)
      if (e.kind === 'smoke') pushReaction('smoke', e.payload?.name ?? '')
      else if (e.kind === 'emote') pushReaction('emote', e.payload?.name ?? '', e.payload?.emoji)
    }
  }

  const pollGameStart = async (code: string) => {
    if (started) return
    const game = await fetchGame(code)
    if (game) {
      started = true
      get().onStart?.()
    }
  }

  return {
    code: null,
    me: null,
    status: 'idle',
    players: [],
    reactions: [],
    mySeat: null,
    lastStatus: null,

    setOnStart: (fn) => set({ onStart: fn }),

    connect: (code, me) => {
      const s = get()
      if (s.code === code && s.me?.id === me.id && timers.length) {
        set({ me })
        return
      }
      clearTimers()
      started = false
      eventCursor = 0
      mySeatLocal = null
      try {
        localStorage.setItem('tranca.room', code)
      } catch {
        /* ignore */
      }
      if (!supabase) {
        set({ status: 'no-backend', code, me, lastStatus: 'sem backend (.env)' })
        return
      }
      set({ code, me, status: 'connecting', players: [], mySeat: null, lastStatus: null })

      // bate o ponto já, e depois em ciclo
      void heartbeat(code, { id: me.id, name: me.name, seat: mySeatLocal })
      void latestEventId(code).then((id) => (eventCursor = id))
      void pollPlayers(code, me)

      timers.push(setInterval(() => heartbeat(code, { id: me.id, name: me.name, seat: mySeatLocal }), 4000))
      timers.push(setInterval(() => pollPlayers(code, me), 2500))
      timers.push(setInterval(() => pollEvents(code), 2000))
      timers.push(setInterval(() => pollGameStart(code), 2500))
    },

    disconnect: () => {
      clearTimers()
      const { code, me } = get()
      if (code && me) void leaveRoom(code, me.id)
      started = false
      mySeatLocal = null
      try {
        localStorage.removeItem('tranca.room')
      } catch {
        /* ignore */
      }
      set({ code: null, me: null, status: 'idle', players: [], reactions: [], mySeat: null })
    },

    chooseSeat: (seat) => {
      const { code, me } = get()
      mySeatLocal = seat
      set({ mySeat: seat })
      if (code && me) {
        void heartbeat(code, { id: me.id, name: me.name, seat }).then(() => pollPlayers(code, me))
      }
    },

    start: () => {
      // sem WebSocket: o início é detectado pelo polling quando a partida aparece em `games`
      started = false
    },

    sendSmoke: () => {
      const { code, me } = get()
      if (code) void sendEvent(code, 'smoke', { name: me?.name })
    },

    sendEmote: (emoji) => {
      const { code, me } = get()
      if (code) void sendEvent(code, 'emote', { name: me?.name, emoji })
    },
  }
})
