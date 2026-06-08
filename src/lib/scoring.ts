import { Card, isWild } from './types'

/**
 * Constantes de pontuação — regras da casa.
 * TODA carta vale 10 pontos. Coringa (2) também 10. Sem exceções de valor por carta.
 */
export const CARD_POINTS = 10

export const BONUS = {
  CANASTRA_LIMPA: 200, // 7+ cartas, sem coringa
  CANASTRA_SUJA: 100, // 7+ cartas, com coringa
  BATER: 100, // encerrar a mão (exige morto pego + >=1 canastra)
  TRES_VERMELHO: 100, // cada 3 vermelho baixado
  TRES_PRETO_NA_MAO: -100, // penalidade ao bater com 3 preto na mão
  MORTO_NAO_PEGO: -100, // dupla que não pegou o morto
} as const

/** Pontuação-alvo padrão da partida (configurável na sala). */
export const TARGET_SCORE_DEFAULT = 3000

export interface Meld {
  cards: Card[] // sequência do mesmo naipe, em ordem
}

/** Uma sequência de 7+ cartas é canastra. Limpa se não tiver coringa (2). */
export function isCanastra(meld: Meld): boolean {
  return meld.cards.length >= 7
}
export function isCanastraLimpa(meld: Meld): boolean {
  return isCanastra(meld) && !meld.cards.some(isWild)
}

/** Pontos brutos das cartas de uma lista (cada carta = 10). */
export function cardsPoints(cards: Card[]): number {
  return cards.length * CARD_POINTS
}

export interface HandScoreInput {
  melds: Meld[] // sequências baixadas pela dupla
  redThrees: number // qtd de 3 vermelhos baixados
  battedWithBlackThree: boolean // bateu com 3 preto na mão?
  tookMorto: boolean // a dupla pegou o morto?
  hasBatted: boolean // a dupla bateu?
  cardsInHand: Card[] // cartas que sobraram na mão (contam negativo)
}

/** Calcula a pontuação de uma dupla ao fim da mão. */
export function scoreHand(input: HandScoreInput): number {
  let total = 0
  for (const meld of input.melds) {
    total += cardsPoints(meld.cards)
    if (isCanastra(meld)) {
      total += isCanastraLimpa(meld) ? BONUS.CANASTRA_LIMPA : BONUS.CANASTRA_SUJA
    }
  }
  total += input.redThrees * BONUS.TRES_VERMELHO
  if (input.hasBatted) total += BONUS.BATER
  if (input.battedWithBlackThree) total += BONUS.TRES_PRETO_NA_MAO
  if (!input.tookMorto) total += BONUS.MORTO_NAO_PEGO
  total -= cardsPoints(input.cardsInHand)
  return total
}
