import { Card, isBlackThree, isRedThree } from '@/lib/types'
import { scoreHand, BONUS } from '@/lib/scoring'
import { validateSequence, isCanastra, sortSequence } from './sequence'
import {
  GameState, Meld, Seat, Team, SEATS, teamOf, newMeldId, dealHand,
} from './state'

export type Action =
  | { type: 'draw' }
  | { type: 'takeDiscard' }
  | { type: 'meld'; cardIds: string[] }
  | { type: 'addToMeld'; meldId: string; cardIds: string[] }
  | { type: 'discard'; cardId: string }
  | { type: 'nextHand' }

export interface ApplyResult {
  state: GameState
  error?: string
}

const clone = (s: GameState): GameState => structuredClone(s)
const seatsOf = (t: Team): Seat[] => SEATS.filter((s) => teamOf(s) === t)
const hasCanastra = (s: GameState, t: Team) => s.melds[t].some((m) => isCanastra(m.cards))

function pull(hand: Card[], ids: string[]): { picked: Card[]; rest: Card[] } | null {
  const picked: Card[] = []
  const rest = [...hand]
  for (const id of ids) {
    const i = rest.findIndex((c) => c.id === id)
    if (i === -1) return null
    picked.push(rest[i])
    rest.splice(i, 1)
  }
  return { picked, rest }
}

const ok = (state: GameState): ApplyResult => ({ state })
const fail = (state: GameState, error: string): ApplyResult => ({ state, error })

/** Aplica uma ação do jogador `actor`. Retorna novo estado ou erro (estado inalterado). */
export function apply(state: GameState, action: Action, actor: Seat): ApplyResult {
  if (action.type === 'nextHand') {
    if (state.phase !== 'handOver') return fail(state, 'A mão ainda não terminou.')
    return ok(
      dealHand({
        handNumber: state.handNumber + 1,
        dealer: ((state.dealer + 1) % 4) as Seat,
        scores: state.scores,
        target: state.target,
      }),
    )
  }

  if (state.phase === 'handOver' || state.phase === 'matchOver')
    return fail(state, 'A mão já terminou.')
  if (actor !== state.turn) return fail(state, 'Não é a sua vez.')

  switch (action.type) {
    case 'draw': {
      if (state.phase !== 'draw' || state.hasDrawn) return fail(state, 'Você já comprou nesta vez.')
      const s = clone(state)
      if (s.stock.length === 0) return endHand(s) // monte acabou: encerra a mão
      const team = teamOf(actor)
      // compra do topo; 3 vermelho baixa sozinho e compra de novo
      let card = s.stock.pop()!
      while (isRedThree(card)) {
        s.redThrees[team].push(card)
        s.log.push(`${seatName(actor)} tirou um 3 vermelho (+100) e comprou outra.`)
        if (s.stock.length === 0) break
        card = s.stock.pop()!
      }
      if (!isRedThree(card)) s.hands[actor].push(card)
      s.hasDrawn = true
      s.phase = 'play'
      return ok(s)
    }

    case 'takeDiscard': {
      if (state.phase !== 'draw' || state.hasDrawn) return fail(state, 'Você já comprou nesta vez.')
      if (state.discardLocked) return fail(state, 'O lixo está trancado (3 preto no topo).')
      if (state.discard.length === 0) return fail(state, 'O lixo está vazio.')
      const s = clone(state)
      s.hands[actor].push(...s.discard)
      s.discard = []
      s.hasDrawn = true
      s.phase = 'play'
      s.log.push(`${seatName(actor)} pegou o lixo.`)
      return ok(s)
    }

    case 'meld': {
      if (state.phase !== 'play') return fail(state, 'Compre antes de baixar.')
      const picked = pull(state.hands[actor], action.cardIds)
      if (!picked) return fail(state, 'Cartas inválidas.')
      const check = validateSequence(picked.picked)
      if (!check.ok) return fail(state, check.reason ?? 'Sequência inválida.')
      const s = clone(state)
      const team = teamOf(actor)
      s.hands[actor] = picked.rest
      const meld: Meld = { id: newMeldId(), cards: sortSequence(picked.picked) }
      s.melds[team].push(meld)
      s.log.push(`${seatName(actor)} baixou uma sequência de ${picked.picked.length}.`)
      return ok(afterShrink(s, actor))
    }

    case 'addToMeld': {
      if (state.phase !== 'play') return fail(state, 'Compre antes de baixar.')
      const team = teamOf(actor)
      const meld = state.melds[team].find((m) => m.id === action.meldId)
      if (!meld) return fail(state, 'Jogo não encontrado.')
      const picked = pull(state.hands[actor], action.cardIds)
      if (!picked) return fail(state, 'Cartas inválidas.')
      const combined = [...meld.cards, ...picked.picked]
      const check = validateSequence(combined)
      if (!check.ok) return fail(state, check.reason ?? 'Não encaixa nessa sequência.')
      const s = clone(state)
      s.hands[actor] = picked.rest
      const m = s.melds[team].find((x) => x.id === action.meldId)!
      m.cards = sortSequence(combined)
      s.log.push(`${seatName(actor)} encaixou ${picked.picked.length} carta(s).`)
      return ok(afterShrink(s, actor))
    }

    case 'discard': {
      if (state.phase !== 'play') return fail(state, 'Compre antes de descartar.')
      const team = teamOf(actor)
      const i = state.hands[actor].findIndex((c) => c.id === action.cardId)
      if (i === -1) return fail(state, 'Carta não está na sua mão.')
      const card = state.hands[actor][i]
      const wouldEmpty = state.hands[actor].length === 1

      if (wouldEmpty && state.tookMorto[team] && !hasCanastra(s0(state), team))
        return fail(state, 'Você precisa de pelo menos uma canastra para bater.')

      const s = clone(state)
      s.hands[actor].splice(i, 1)
      s.discard.push(card)
      s.discardLocked = isBlackThree(card)

      if (s.hands[actor].length === 0) {
        if (!s.tookMorto[team]) {
          // pega o morto e continua jogando
          const morto = s.mortos.pop() ?? []
          s.hands[actor] = morto
          s.tookMorto[team] = true
          s.log.push(`${seatName(actor)} esvaziou a mão e pegou o morto.`)
          return ok(s) // turno continua
        }
        // bate!
        s.log.push(`${seatName(actor)} bateu! 🎉`)
        return endHand(s, team)
      }

      // descarte normal: passa a vez
      s.turn = ((actor + 1) % 4) as Seat
      s.phase = 'draw'
      s.hasDrawn = false
      return ok(s)
    }
  }
}

const s0 = (s: GameState) => s // helper p/ leitura (evita clone só pra checar canastra)

/** Quando a mão de quem jogou esvazia ao BAIXAR (não no descarte): pega morto ou bate. */
function afterShrink(s: GameState, actor: Seat): GameState {
  const team = teamOf(actor)
  if (s.hands[actor].length > 0) return s
  if (!s.tookMorto[team]) {
    const morto = s.mortos.pop() ?? []
    s.hands[actor] = morto
    s.tookMorto[team] = true
    s.log.push(`${seatName(actor)} baixou tudo e pegou o morto.`)
    return s
  }
  if (hasCanastra(s, team)) {
    s.log.push(`${seatName(actor)} bateu baixando tudo! 🎉`)
    return endHand(s, team).state
  }
  return s // mão vazia, sem morto p/ pegar e sem canastra — segue (vai precisar de carta; caso de borda)
}

/** Encerra a mão: pontua as duas duplas, acumula e checa o alvo da partida. */
function endHand(s: GameState, batedor?: Team): ApplyResult {
  const teams: Team[] = ['nos', 'eles']
  for (const t of teams) {
    const handCards = seatsOf(t).flatMap((seat) => s.hands[seat])
    const blackThrees = handCards.filter(isBlackThree).length
    const delta = scoreHand({
      melds: s.melds[t].map((m) => ({ cards: m.cards })),
      redThrees: s.redThrees[t].length,
      battedWithBlackThree: blackThrees > 0,
      tookMorto: s.tookMorto[t],
      hasBatted: batedor === t,
      cardsInHand: handCards.filter((c) => !isBlackThree(c)),
    })
    // penalidade extra por 3 preto na mão é tratada via flag acima (−100); some ao delta
    s.scores[t] += delta
    s.log.push(`Dupla ${t === 'nos' ? 'Nós' : 'Eles'}: ${delta >= 0 ? '+' : ''}${delta} (total ${s.scores[t]})`)
  }
  void BONUS
  const reached = teams.filter((t) => s.scores[t] >= s.target)
  if (reached.length > 0) {
    s.winner = reached.sort((a, b) => s.scores[b] - s.scores[a])[0]
    s.phase = 'matchOver'
    s.log.push(`Fim de jogo! Dupla ${s.winner === 'nos' ? 'Nós' : 'Eles'} venceu.`)
  } else {
    s.phase = 'handOver'
  }
  return { state: s }
}

function seatName(seat: Seat): string {
  return `Assento ${seat}`
}

export { dealHand }
