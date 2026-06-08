import { Card, isRedThree } from '@/lib/types'
import { buildDeck, shuffle } from '@/lib/deck'

export type Seat = 0 | 1 | 2 | 3
export type Team = 'nos' | 'eles'
export const SEATS: Seat[] = [0, 1, 2, 3]
export const teamOf = (seat: Seat): Team => (seat % 2 === 0 ? 'nos' : 'eles')

export type Phase = 'draw' | 'play' | 'handOver' | 'matchOver'

export interface Meld {
  id: string
  cards: Card[] // sequência ordenada do mesmo naipe
}

export interface SeatPlayer {
  id: string
  name: string
}

export interface GameState {
  players: Record<Seat, SeatPlayer | null> // quem está em cada assento
  handNumber: number
  stock: Card[]
  discard: Card[]
  discardLocked: boolean // 3 preto no topo trava a compra do lixo
  mortos: Card[][] // 2 mortos de 11
  hands: Record<Seat, Card[]>
  melds: Record<Team, Meld[]>
  redThrees: Record<Team, Card[]>
  tookMorto: Record<Team, boolean>
  scores: Record<Team, number> // acumulado da partida
  turn: Seat
  phase: Phase
  hasDrawn: boolean // já comprou nesta vez?
  target: number
  dealer: Seat
  winner?: Team
  log: string[]
}

let meldSeq = 0
export const newMeldId = () => `m${meldSeq++}`

/** Distribui uma nova mão. Os 3 vermelhos saem das mãos e já entram como bônus da dupla. */
export function dealHand(opts: {
  handNumber: number
  dealer: Seat
  scores: Record<Team, number>
  target: number
  seed?: string
  players?: Record<Seat, SeatPlayer | null>
}): GameState {
  const deck = shuffle(buildDeck(), seededRng(opts.seed))
  const d = [...deck]
  const hands: Record<Seat, Card[]> = { 0: [], 1: [], 2: [], 3: [] }
  for (let i = 0; i < 11; i++) for (const s of SEATS) hands[s].push(d.shift()!)
  const mortos = [d.splice(0, 11), d.splice(0, 11)]

  const redThrees: Record<Team, Card[]> = { nos: [], eles: [] }
  // tira 3 vermelhos das mãos e repõe cartas; vira bônus da dupla do assento
  for (const s of SEATS) {
    const keep: Card[] = []
    for (const c of hands[s]) {
      if (isRedThree(c)) {
        redThrees[teamOf(s)].push(c)
        const repl = d.shift()
        if (repl) keep.push(repl)
      } else keep.push(c)
    }
    hands[s] = keep
  }

  const firstToPlay = ((opts.dealer + 1) % 4) as Seat
  return {
    players: opts.players ?? { 0: null, 1: null, 2: null, 3: null },
    handNumber: opts.handNumber,
    stock: d,
    discard: [],
    discardLocked: false,
    mortos,
    hands,
    melds: { nos: [], eles: [] },
    redThrees,
    tookMorto: { nos: false, eles: false },
    scores: { ...opts.scores },
    turn: firstToPlay,
    phase: 'draw',
    hasDrawn: false,
    target: opts.target,
    dealer: opts.dealer,
    log: ['Mão distribuída.'],
  }
}

/** RNG determinístico (mulberry32) a partir de uma seed string — partidas sincronizáveis. */
export function seededRng(seed?: string): () => number {
  if (!seed) return Math.random
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
