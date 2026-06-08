import { Card, RANKS, SUITS } from './types'

/**
 * Monta o baralho da Tranca: 2 baralhos franceses completos, SEM coringa/Joker.
 * Total: 2 x 52 = 104 cartas. (Os "2" funcionam como coringa, mas continuam no baralho.)
 */
export function buildDeck(): Card[] {
  const deck: Card[] = []
  for (let copy = 0; copy < 2; copy++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ id: `${rank}-${suit}-${copy}`, suit, rank })
      }
    }
  }
  return deck
}

/** Fisher–Yates. Aceita um RNG injetável para partidas determinísticas/sincronizadas. */
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface DealtGame {
  hands: Card[][] // 4 mãos de 11 cartas
  mortos: [Card[], Card[]] // 2 mortos de 11 cartas
  stock: Card[] // monte de compra (restante)
  discard: Card[] // lixo (começa vazio)
}

/**
 * Distribui uma partida: 11 cartas para cada um dos 4 jogadores,
 * 2 mortos de 11 e o restante vira o monte de compra (38 cartas).
 */
export function deal(deck: Card[]): DealtGame {
  const d = [...deck]
  const hands: Card[][] = [[], [], [], []]
  for (let i = 0; i < 11; i++) {
    for (let p = 0; p < 4; p++) hands[p].push(d.shift()!)
  }
  const mortos: [Card[], Card[]] = [d.splice(0, 11), d.splice(0, 11)]
  return { hands, mortos, stock: d, discard: [] }
}
