import { Card, Rank, Suit, isWild } from '@/lib/types'

/**
 * Valor de ordenação numa sequência. O 3 NÃO entra em sequência (vermelho vai pro bônus,
 * preto tranca o lixo), então não tem posição. O Ás é sempre ALTO (Q-K-A); Ás baixo não
 * forma sequência porque esbarraria no 3 (A-2-3 é proibido).
 */
const RANK_VALUE: Partial<Record<Rank, number>> = {
  '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  J: 11, Q: 12, K: 13, A: 14,
}
const LO = 4 // menor posição válida
const HI = 14 // Ás alto

const isThree = (c: Card) => c.rank === '3'

export interface SequenceCheck {
  ok: boolean
  reason?: string
  suit?: Suit
}

/**
 * Valida uma sequência da tranca:
 * - mesmo naipe, ranks consecutivos, mínimo 3 cartas;
 * - o 2 é coringa e preenche lacunas (qualquer 2, de qualquer naipe), mas nunca vale como 3;
 * - NENHUM 3 entra em sequência (nem vermelho nem preto);
 * - Ás é alto (…Q-K-A). Não dá a volta.
 */
export function validateSequence(cards: Card[]): SequenceCheck {
  if (cards.length < 3) return { ok: false, reason: 'Uma sequência precisa de pelo menos 3 cartas.' }
  if (cards.some(isThree))
    return { ok: false, reason: 'O 3 não entra em sequência (vermelho vai pro bônus, preto tranca o lixo).' }

  const naturals = cards.filter((c) => !isWild(c))
  const wilds = cards.filter(isWild)
  if (naturals.length === 0)
    return { ok: false, reason: 'A sequência precisa de cartas naturais (não só coringas).' }
  if (wilds.length > naturals.length)
    return { ok: false, reason: 'Coringas demais para essa sequência.' }

  const suit = naturals[0].suit
  if (!naturals.every((c) => c.suit === suit))
    return { ok: false, reason: 'Todas as cartas naturais devem ser do mesmo naipe.' }

  const L = cards.length
  const positions = naturals.map((c) => RANK_VALUE[c.rank]!)
  if (new Set(positions).size !== positions.length)
    return { ok: false, reason: 'Há cartas de mesmo valor — não formam sequência.' }

  const min = Math.min(...positions)
  const max = Math.max(...positions)
  if (max - min + 1 > L)
    return { ok: false, reason: 'As cartas não formam uma sequência consecutiva.' }

  // janela [s, s+L-1] contém todos os naturais e fica dentro de [LO, HI]
  const sMin = Math.max(LO, max - L + 1)
  const sMax = Math.min(min, HI - L + 1)
  if (sMin <= sMax) return { ok: true, suit }
  return { ok: false, reason: 'As cartas não formam uma sequência consecutiva do mesmo naipe.' }
}

/**
 * Trinca: jogo de cartas de MESMO VALOR (ex.: 4-4-4, A-A-A), mínimo 3, até virar canastra.
 * O 2 é coringa; o 3 não forma jogo (vermelho vai pro bônus, preto tranca).
 */
export function validateSet(cards: Card[]): SequenceCheck {
  if (cards.length < 3) return { ok: false, reason: 'Um jogo precisa de pelo menos 3 cartas.' }
  if (cards.some(isThree)) return { ok: false, reason: 'O 3 não forma jogo.' }
  const naturals = cards.filter((c) => !isWild(c))
  const wilds = cards.filter(isWild)
  if (naturals.length === 0)
    return { ok: false, reason: 'O jogo precisa de cartas naturais (não só coringas).' }
  const rank = naturals[0].rank
  if (!naturals.every((c) => c.rank === rank))
    return { ok: false, reason: 'Num jogo de cartas iguais, todas precisam ter o mesmo valor.' }
  if (wilds.length > naturals.length) return { ok: false, reason: 'Coringas demais para esse jogo.' }
  return { ok: true }
}

/** Um jogo válido é uma SEQUÊNCIA (mesmo naipe) OU uma TRINCA (mesmo valor). */
export function validateMeld(cards: Card[]): SequenceCheck {
  const seq = validateSequence(cards)
  if (seq.ok) return seq
  const set = validateSet(cards)
  if (set.ok) return set
  return {
    ok: false,
    reason: 'Não forma sequência do mesmo naipe nem trinca de cartas iguais.',
  }
}

/** Canastra = 7+ cartas. */
export function isCanastra(cards: Card[]): boolean {
  return cards.length >= 7
}
/** Limpa = canastra sem nenhum coringa (2). */
export function isCanastraLimpa(cards: Card[]): boolean {
  return isCanastra(cards) && !cards.some(isWild)
}

/** Ordena cartas pra exibição (Ás alto; coringas ao fim só p/ estabilidade visual). */
export function sortSequence(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (isWild(a) && !isWild(b)) return 1
    if (!isWild(a) && isWild(b)) return -1
    return (RANK_VALUE[a.rank] ?? 0) - (RANK_VALUE[b.rank] ?? 0)
  })
}
