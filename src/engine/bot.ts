import { Card, isWild, isRedThree, isBlackThree } from '@/lib/types'
import { GameState, Seat, teamOf } from './state'
import { validateMeld, LAVADEIRA_RANKS } from './sequence'
import { podeBater, type Action } from './engine'

/**
 * Bot simples porém honesto: joga pelas MESMAS ações do motor (nunca trapaceia).
 * Estratégia gulosa: baixa 3 vermelho, cresce jogos existentes, forma jogos novos
 * quando dá, e descarta a carta menos útil. Uma ação por chamada — o driver
 * (na mesa) chama de novo até a vez passar.
 */

const RANK_VAL: Record<string, number> = {
  '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14,
}

/** Acha um jogo novo válido (trinca de iguais ou sequência do mesmo naipe). Retorna ids ou null. */
function findNewMeld(hand: Card[]): string[] | null {
  const usable = hand.filter((c) => c.rank !== '3') // 3 nunca forma jogo
  const wild = usable.find(isWild) ?? null
  const naturals = usable.filter((c) => !isWild(c))

  // 1) Lavadeira: 3+ cartas do mesmo valor — SÓ 4 e Ás (regra da casa)
  const byRank = new Map<string, Card[]>()
  for (const c of naturals) {
    if (!LAVADEIRA_RANKS.includes(c.rank)) continue
    const arr = byRank.get(c.rank) ?? []
    arr.push(c)
    byRank.set(c.rank, arr)
  }
  for (const [, cards] of byRank) {
    if (cards.length >= 3) {
      const pick = cards.slice(0, Math.min(cards.length, 7))
      if (validateMeld(pick).ok) return pick.map((c) => c.id)
    }
  }

  // 2) Sequência do mesmo naipe (Ás alto, sem 3)
  const bySuit = new Map<string, Card[]>()
  for (const c of naturals) {
    const arr = bySuit.get(c.suit) ?? []
    arr.push(c)
    bySuit.set(c.suit, arr)
  }
  for (const [, cards] of bySuit) {
    // uma carta por valor, ordenadas
    const uniq = new Map<number, Card>()
    for (const c of cards) if (!uniq.has(RANK_VAL[c.rank])) uniq.set(RANK_VAL[c.rank], c)
    const vals = [...uniq.keys()].sort((a, b) => a - b)
    let run: Card[] = []
    for (let i = 0; i < vals.length; i++) {
      if (run.length === 0 || vals[i] === RANK_VAL[run[run.length - 1].rank] + 1) {
        run.push(uniq.get(vals[i])!)
      } else {
        if (run.length >= 3) break
        run = [uniq.get(vals[i])!]
      }
    }
    if (run.length >= 3 && validateMeld(run).ok) return run.map((c) => c.id)
    // sequência de 3 usando 1 coringa pra fechar um buraco de 1
    if (wild && naturals.length >= 2) {
      for (let i = 0; i < vals.length - 1; i++) {
        if (vals[i + 1] - vals[i] === 2) {
          const trio = [uniq.get(vals[i])!, wild, uniq.get(vals[i + 1])!]
          if (validateMeld(trio).ok) return trio.map((c) => c.id)
        }
      }
    }
  }
  return null
}

/** Pontua o quão "útil" é manter uma carta (maior = mais útil). */
function keepScore(hand: Card[], c: Card): number {
  if (isWild(c)) return 100 // nunca descarta coringa
  if (isRedThree(c)) return 100 // vai pro bônus, não descarta
  if (isBlackThree(c)) return -50 // dead weight + risco de -100: bom de descartar
  let score = 0
  for (const o of hand) {
    if (o.id === c.id) continue
    if (o.rank === c.rank) score += 3 // ajuda trinca
    if (o.suit === c.suit && Math.abs((RANK_VAL[o.rank] ?? 0) - (RANK_VAL[c.rank] ?? 0)) <= 2) score += 2
  }
  return score
}

function chooseDiscard(state: GameState, seat: Seat): string {
  const hand = state.hands[seat]
  let worst = hand[0]
  let worstScore = Infinity
  for (const c of hand) {
    const s = keepScore(hand, c)
    if (s < worstScore) {
      worstScore = s
      worst = c
    }
  }
  return worst.id
}

/**
 * Deixar a mão com menos de 2 cartas só vale se a dupla puder pegar o morto ou
 * bater de fato — senão o bot fica com 1 carta que não pode descartar e trava.
 */
function meldIsSafe(state: GameState, seat: Seat, used: number): boolean {
  const team = teamOf(seat)
  const remaining = state.hands[seat].length - used
  if (remaining >= 2) return true // sobra carta pro descarte
  const podePegarMorto = !state.tookMorto[team] && state.mortos.length > 0
  return podePegarMorto || podeBater(state, team)
}

/**
 * Pegar o lixo, quando dá: além de render várias cartas de uma vez, NÃO gasta o
 * monte — e era isso que fazia a mão morrer cedo demais (o monte secava antes de
 * alguém conseguir bater). Devolve as cartas da mão que fecham jogo com o topo.
 */
function findTakeDiscard(state: GameState, seat: Seat): Action | null {
  if (state.discardLocked) return null
  const top = state.discard[state.discard.length - 1]
  if (!top || top.rank === '3') return null
  const team = teamOf(seat)

  // (a) o topo encaixa num jogo já baixado da dupla
  for (const m of state.melds[team]) {
    if (validateMeld([...m.cards, top]).ok) return { type: 'takeDiscard', meldWith: [] }
  }

  // (b) o topo fecha jogo novo com 2 cartas da mão
  const hand = state.hands[seat]
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      if (validateMeld([top, hand[i], hand[j]]).ok) {
        return { type: 'takeDiscard', meldWith: [hand[i].id, hand[j].id] }
      }
    }
  }
  return null
}

/** Próxima ação do bot no assento `seat`. Sempre progride (na pior das hipóteses, descarta). */
export function nextBotAction(state: GameState, seat: Seat): Action | null {
  if (state.turn !== seat) return null

  if (state.phase === 'draw' && !state.hasDrawn) {
    return findTakeDiscard(state, seat) ?? { type: 'draw' }
  }

  if (state.phase === 'play') {
    const hand = state.hands[seat]
    const team = teamOf(seat)

    // 1) baixa 3 vermelhos (bônus + compra extra).
    // Com o monte vazio não há reposição, então isso pode encolher a mão.
    const reds = hand.filter(isRedThree).map((c) => c.id)
    if (reds.length) {
      const reposicao = Math.min(reds.length, state.stock.length)
      if (meldIsSafe(state, seat, reds.length - reposicao)) {
        return { type: 'layRedThrees', cardIds: reds }
      }
    }

    // 2) cresce um jogo já baixado da dupla (rumo à canastra)
    for (const m of state.melds[team]) {
      for (const c of hand) {
        if (c.rank === '3') continue
        if (validateMeld([...m.cards, c]).ok && meldIsSafe(state, seat, 1)) {
          return { type: 'addToMeld', meldId: m.id, cardIds: [c.id] }
        }
      }
    }

    // 3) forma um jogo novo
    const meld = findNewMeld(hand)
    if (meld && meldIsSafe(state, seat, meld.length)) {
      return { type: 'meld', cardIds: meld }
    }

    // 4) descarta a pior carta (sempre válido, passa a vez)
    return { type: 'discard', cardId: chooseDiscard(state, seat) }
  }

  return null
}
