import { create } from 'zustand'
import { buildDeck, deal, shuffle } from '@/lib/deck'
import { Card, isRedThree } from '@/lib/types'

export type Team = 'nos' | 'eles'

export interface Player {
  id: string
  name: string
  team: Team
  seat: number // 0=eu (baixo), 1=esquerda, 2=parceiro (topo), 3=direita
}

interface TeamState {
  melds: Card[][] // sequências baixadas
  redThrees: Card[] // 3 vermelhos (bônus)
  tookMorto: boolean
  score: number
}

interface GameState {
  players: Player[]
  myHand: Card[]
  handCounts: Record<number, number> // qtd de cartas por assento (oponentes/parceiro)
  stockCount: number
  discard: Card[]
  mortoCounts: [number, number]
  teams: Record<Team, TeamState>
  turnSeat: number
  round: number
  selected: Set<string>
  // ações (locais por enquanto; viram chamadas ao Supabase na integração)
  toggleSelect: (id: string) => void
  clearSelection: () => void
  drawFromStock: () => void
  takeDiscard: () => void
  discardSelected: () => void
  meldSelected: () => void
  newGame: () => void
}

const MY_SEAT = 0

function freshDeal() {
  const d = deal(shuffle(buildDeck()))
  // 3 vermelhos saem da mão e já entram como bônus da dupla (regra da casa)
  const myRaw = d.hands[MY_SEAT]
  const myRed = myRaw.filter(isRedThree)
  const myHand = myRaw.filter((c) => !isRedThree(c))
  return { d, myHand, myRed }
}

export const useGame = create<GameState>((set) => {
  const { d, myHand, myRed } = freshDeal()
  return {
    players: [
      { id: 'me', name: 'Você', team: 'nos', seat: 0 },
      { id: 'p1', name: 'Rafa', team: 'eles', seat: 1 },
      { id: 'p2', name: 'Bia', team: 'nos', seat: 2 },
      { id: 'p3', name: 'Léo', team: 'eles', seat: 3 },
    ],
    myHand,
    handCounts: { 1: 11, 2: 11, 3: 11 },
    stockCount: d.stock.length,
    discard: d.discard,
    mortoCounts: [d.mortos[0].length, d.mortos[1].length],
    teams: {
      nos: { melds: [], redThrees: myRed, tookMorto: false, score: 0 },
      eles: { melds: [], redThrees: [], tookMorto: false, score: 0 },
    },
    turnSeat: 0,
    round: 1,
    selected: new Set<string>(),

    toggleSelect: (id) =>
      set((s) => {
        const next = new Set(s.selected)
        next.has(id) ? next.delete(id) : next.add(id)
        return { selected: next }
      }),

    clearSelection: () => set({ selected: new Set() }),

    drawFromStock: () =>
      set((s) => {
        if (s.stockCount <= 0) return s
        // demo local: cria uma carta "comprada" genérica do topo do monte
        const card: Card = { id: `stock-${s.stockCount}`, suit: 'paus', rank: 'A' }
        return { stockCount: s.stockCount - 1, myHand: [...s.myHand, card] }
      }),

    takeDiscard: () =>
      set((s) => {
        if (s.discard.length === 0) return s
        return { myHand: [...s.myHand, ...s.discard], discard: [] }
      }),

    discardSelected: () =>
      set((s) => {
        if (s.selected.size !== 1) return s
        const id = [...s.selected][0]
        const card = s.myHand.find((c) => c.id === id)
        if (!card) return s
        return {
          myHand: s.myHand.filter((c) => c.id !== id),
          discard: [...s.discard, card],
          selected: new Set(),
        }
      }),

    meldSelected: () =>
      set((s) => {
        if (s.selected.size < 3) return s
        const chosen = s.myHand.filter((c) => s.selected.has(c.id))
        // validação completa da sequência vem na Fase 2; aqui só baixa visualmente
        return {
          myHand: s.myHand.filter((c) => !s.selected.has(c.id)),
          teams: {
            ...s.teams,
            nos: { ...s.teams.nos, melds: [...s.teams.nos.melds, chosen] },
          },
          selected: new Set(),
        }
      }),

    newGame: () => {
      const { d, myHand, myRed } = freshDeal()
      set((s) => ({
        myHand,
        handCounts: { 1: 11, 2: 11, 3: 11 },
        stockCount: d.stock.length,
        discard: [],
        mortoCounts: [d.mortos[0].length, d.mortos[1].length],
        round: s.round + 1,
        teams: {
          nos: { ...s.teams.nos, melds: [], redThrees: myRed },
          eles: { ...s.teams.eles, melds: [], redThrees: [] },
        },
        selected: new Set(),
      }))
    },
  }
})
