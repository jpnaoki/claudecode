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
  TRES_PRETO_NA_MAO: -100, // penalidade por CADA 3 preto que sobrar na mão no fim da mão
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
  blackThreesInHand: number // qtd de 3 pretos que sobraram na mão: -100 CADA
  tookMorto: boolean // a dupla pegou o morto?
  hasBatted: boolean // a dupla bateu?
  cardsInHand: Card[] // cartas que sobraram na mão (contam negativo)
}

/** Uma linha do extrato de pontos — o jogador precisa ENTENDER de onde veio o placar. */
export interface ScoreLine {
  label: string
  value: number
  detail?: string
}
export interface HandScore {
  total: number
  lines: ScoreLine[]
}

/** Pontuação da dupla ao fim da mão, com o extrato item a item. */
export function scoreHandDetailed(input: HandScoreInput): HandScore {
  const lines: ScoreLine[] = []

  const cartasBaixadas = input.melds.reduce((n, m) => n + m.cards.length, 0)
  if (cartasBaixadas > 0) {
    lines.push({
      label: 'Cartas baixadas',
      value: cartasBaixadas * CARD_POINTS,
      detail: `${cartasBaixadas} × 10`,
    })
  }

  const limpas = input.melds.filter(isCanastraLimpa).length
  const sujas = input.melds.filter((m) => isCanastra(m) && !isCanastraLimpa(m)).length
  if (limpas > 0)
    lines.push({ label: 'Canastra limpa', value: limpas * BONUS.CANASTRA_LIMPA, detail: `${limpas} × 200` })
  if (sujas > 0)
    lines.push({ label: 'Canastra suja', value: sujas * BONUS.CANASTRA_SUJA, detail: `${sujas} × 100` })

  if (input.redThrees > 0)
    lines.push({
      label: '3 vermelho',
      value: input.redThrees * BONUS.TRES_VERMELHO,
      detail: `${input.redThrees} × 100`,
    })

  if (input.hasBatted) lines.push({ label: 'Bateu!', value: BONUS.BATER })

  if (input.blackThreesInHand > 0)
    lines.push({
      label: '3 preto na mão',
      value: input.blackThreesInHand * BONUS.TRES_PRETO_NA_MAO,
      detail: `${input.blackThreesInHand} × −100`,
    })

  if (!input.tookMorto)
    lines.push({ label: 'Não pegou o morto', value: BONUS.MORTO_NAO_PEGO })

  if (input.cardsInHand.length > 0)
    lines.push({
      label: 'Cartas na mão',
      value: -cardsPoints(input.cardsInHand),
      detail: `${input.cardsInHand.length} × −10`,
    })

  return { total: lines.reduce((n, l) => n + l.value, 0), lines }
}

/** Calcula a pontuação de uma dupla ao fim da mão. */
export function scoreHand(input: HandScoreInput): number {
  return scoreHandDetailed(input).total
}
