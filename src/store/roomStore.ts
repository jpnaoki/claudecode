import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Identity } from '@/lib/identity'

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

interface RoomStore {
  code: string | null
  me: Identity | null
  channel: RealtimeChannel | null
  status: RoomStatus
  players: RoomPlayer[]
  reactions: Reaction[]
  mySeat: number | null
  joinedAt: number
  onStart?: () => void

  setOnStart: (fn?: () => void) => void
  connect: (code: string, me: Identity) => void
  disconnect: () => void
  chooseSeat: (seat: number | null) => void
  start: () => void
  sendSmoke: () => void
  sendEmote: (emoji: string) => void
}

export const useRoom = create<RoomStore>((set, get) => ({
  code: null,
  me: null,
  channel: null,
  status: 'idle',
  players: [],
  reactions: [],
  mySeat: null,
  joinedAt: Date.now(),

  setOnStart: (fn) => set({ onStart: fn }),

  connect: (code, me) => {
    const s = get()
    // idempotente: já conectado na mesma sala com o mesmo jogador
    if (s.channel && s.code === code && s.me?.id === me.id) {
      set({ me })
      return
    }
    if (s.channel) supabase?.removeChannel(s.channel)
    try {
      localStorage.setItem('tranca.room', code)
    } catch {
      /* ignore */
    }

    if (!supabase) {
      set({ status: 'no-backend', code, me })
      return
    }

    const joinedAt = Date.now()
    const channel = supabase.channel(`room:${code}`, {
      config: { presence: { key: me.id }, broadcast: { self: true } },
    })

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<RoomPlayer>()
      const list = Object.values(state)
        .map((e) => e[0])
        .filter(Boolean)
        .sort((a, b) => a.joinedAt - b.joinedAt)
      const mine = list.find((p) => p.id === me.id)
      set({ players: list, mySeat: mine?.seat ?? null })
    })

    channel.on('broadcast', { event: 'start' }, () => get().onStart?.())

    const pushReaction = (r: Omit<Reaction, 'id' | 'ts'>) => {
      const reaction: Reaction = { ...r, id: `r${reactionSeq++}`, ts: Date.now() }
      set((st) => ({ reactions: [...st.reactions, reaction] }))
      setTimeout(
        () => set((st) => ({ reactions: st.reactions.filter((x) => x.id !== reaction.id) })),
        4000,
      )
    }

    channel.on('broadcast', { event: 'smoke' }, ({ payload }) =>
      pushReaction({ kind: 'smoke', name: payload?.name ?? '' }),
    )
    channel.on('broadcast', { event: 'emote' }, ({ payload }) =>
      pushReaction({ kind: 'emote', emoji: payload?.emoji, name: payload?.name ?? '' }),
    )

    set({ code, me, channel, status: 'connecting', joinedAt, players: [], mySeat: null })

    channel.subscribe(async (st) => {
      if (st === 'SUBSCRIBED') {
        set({ status: 'connected' })
        await channel.track({ id: me.id, name: me.name || 'Convidado', seat: null, joinedAt })
      } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') {
        set({ status: 'error' })
      }
    })
  },

  disconnect: () => {
    const { channel } = get()
    if (channel) supabase?.removeChannel(channel)
    try {
      localStorage.removeItem('tranca.room')
    } catch {
      /* ignore */
    }
    set({ channel: null, code: null, status: 'idle', players: [], reactions: [], mySeat: null })
  },

  chooseSeat: (seat) => {
    const { channel, me, joinedAt } = get()
    if (!channel || !me) return
    set({ mySeat: seat })
    channel.track({ id: me.id, name: me.name || 'Convidado', seat, joinedAt })
  },

  start: () => {
    const { channel } = get()
    channel?.send({ type: 'broadcast', event: 'start', payload: {} })
  },

  sendSmoke: () => {
    const { channel, me } = get()
    channel?.send({ type: 'broadcast', event: 'smoke', payload: { name: me?.name } })
  },

  sendEmote: (emoji) => {
    const { channel, me } = get()
    channel?.send({ type: 'broadcast', event: 'emote', payload: { emoji, name: me?.name } })
  },
}))

// Auxílio de depuração em dev (ex.: __room.getState().sendSmoke())
if (import.meta.env.DEV) {
  ;(window as unknown as { __room: typeof useRoom }).__room = useRoom
}
