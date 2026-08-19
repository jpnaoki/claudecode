import { Card, isBlackThree, isRedThree, isWild } from '@/lib/types'
import { scoreHandDetailed, BONUS } from '@/lib/scoring'
import { validateMeld, isCanastra, sortSequence } from './sequence'
import {
  GameState, Meld, Seat, Team, SEATS, teamOf, newMeldId, dealHand,
} from './state'

export type Action =
  | { type: 'draw' }
  | { type: 'takeDiscard'; meldWith?: string[] } // cartas da mão que formam jogo com o topo
  | { type: 'meld'; cardIds: string[] }
  | { type: 'addToMeld'; meldId: string; cardIds: string[] }
  | { type: 'layRedThrees'; cardIds: string[] }
  | { type: 'discard'; cardId: string }
  | { type: 'nextHand' }

/**
 * Pode pegar o lixo? Só se a carta do topo: (a) encaixar num jogo já baixado da dupla, ou
 * (b) formar uma sequência válida com 2 cartas da mão. (3 no topo nunca; lixo trancado nunca.)
 */
export function canTakeDiscard(state: GameState, seat: Seat): boolean {
  if (state.discardLocked) return false
  const top = state.discard[state.discard.length - 1]
  if (!top || top.rank === '3') return false
  const team = teamOf(seat)
  for (const m of state.melds[team]) {
    if (validateMeld([...m.cards, top]).ok) return true
  }
  const hand = state.hands[seat]
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      if (validateMeld([top, hand[i], hand[j]]).ok) return true
    }
  }
  return false
}

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
        players: state.players,
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
      // O morto TAMBÉM é jogo: quando o monte acaba, um morto vira monte.
      // A mão só termina quando não sobra nem monte nem morto.
      if (!refillStock(s)) return endHand(s)
      const card = s.stock.pop()!
      s.hands[actor].push(card) // 3 vermelho também entra normal; o jogador baixa depois
      s.lastDrawn = card.id
      s.hasDrawn = true
      s.phase = 'play'
      return ok(s)
    }

    case 'takeDiscard': {
      if (state.phase !== 'draw' || state.hasDrawn) return fail(state, 'Você já comprou nesta vez.')
      if (state.discardLocked)
        return fail(state, 'O lixo está trancado (3 preto ou coringa no topo).')
      if (state.discard.length === 0) return fail(state, 'O lixo está vazio.')
      const top = state.discard[state.discard.length - 1]
      if (top.rank === '3') return fail(state, 'A carta do topo (3) não deixa pegar o lixo.')
      const team = teamOf(actor)
      const meldWith = action.meldWith ?? []
      const withCards = meldWith
        .map((id) => state.hands[actor].find((c) => c.id === id))
        .filter((c): c is Card => !!c)
      // tem que BAIXAR o topo na hora: novo jogo com cartas da mão, OU encaixe num jogo existente
      const canNew =
        meldWith.length > 0 && withCards.length === meldWith.length && validateMeld([top, ...withCards]).ok
      const existing = canNew ? null : state.melds[team].find((m) => validateMeld([...m.cards, top]).ok)
      if (!canNew && !existing)
        return fail(
          state,
          'Pra pegar o lixo, BAIXE o topo na hora: selecione as cartas da mão que formam jogo com ele, ou tenha um jogo onde ele encaixe.',
        )

      const s = clone(state)
      const taken = s.discard.length
      s.hands[actor].push(...s.discard)
      s.discard = []
      s.lastDrawn = null
      s.hasDrawn = true
      s.phase = 'play'

      if (canNew) {
        const pick = pull(s.hands[actor], [top.id, ...meldWith])!
        s.hands[actor] = pick.rest
        s.melds[team].push({ id: newMeldId(), cards: sortSequence(pick.picked) })
        s.log.push(`${seatName(s, actor)} pegou o lixo (${taken} cartas) e baixou o topo ${top.rank}${top.suit[0]}.`)
      } else {
        const pick = pull(s.hands[actor], [top.id])!
        s.hands[actor] = pick.rest
        const m = s.melds[team].find((x) => x.id === existing!.id)!
        m.cards = sortSequence([...m.cards, top])
        s.log.push(`${seatName(s, actor)} pegou o lixo (${taken} cartas) e encaixou o topo ${top.rank}${top.suit[0]}.`)
      }
      return ok(afterShrink(s, actor))
    }

    case 'layRedThrees': {
      if (state.phase !== 'play') return fail(state, 'Compre antes de baixar.')
      const picked = pull(state.hands[actor], action.cardIds)
      if (!picked || picked.picked.length === 0) return fail(state, 'Cartas inválidas.')
      if (!picked.picked.every(isRedThree)) return fail(state, 'Aqui só entram 3 vermelhos.')
      const s = clone(state)
      const team = teamOf(actor)
      s.hands[actor] = picked.rest
      let extra = 0
      for (const c of picked.picked) {
        s.redThrees[team].push(c)
        if (refillStock(s)) {
          const repl = s.stock.pop()!
          s.hands[actor].push(repl)
          s.lastDrawn = repl.id
          extra++
        }
      }
      s.log.push(
        `${seatName(s, actor)} baixou ${picked.picked.length} três vermelho (+${picked.picked.length * 100}) e comprou ${extra}.`,
      )
      return ok(s)
    }

    case 'meld': {
      if (state.phase !== 'play') return fail(state, 'Compre antes de baixar.')
      const picked = pull(state.hands[actor], action.cardIds)
      if (!picked) return fail(state, 'Cartas inválidas.')
      const check = validateMeld(picked.picked)
      if (!check.ok) return fail(state, check.reason ?? 'Sequência inválida.')
      const s = clone(state)
      const team = teamOf(actor)
      s.hands[actor] = picked.rest
      const meld: Meld = { id: newMeldId(), cards: sortSequence(picked.picked) }
      s.melds[team].push(meld)
      s.log.push(`${seatName(s, actor)} baixou uma sequência de ${picked.picked.length}.`)
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
      const check = validateMeld(combined)
      if (!check.ok) return fail(state, check.reason ?? 'Não encaixa nessa sequência.')
      const s = clone(state)
      s.hands[actor] = picked.rest
      const m = s.melds[team].find((x) => x.id === action.meldId)!
      m.cards = sortSequence(combined)
      s.log.push(`${seatName(s, actor)} encaixou ${picked.picked.length} carta(s).`)
      return ok(afterShrink(s, actor))
    }

    case 'discard': {
      if (state.phase !== 'play') return fail(state, 'Compre antes de descartar.')
      const team = teamOf(actor)
      const i = state.hands[actor].findIndex((c) => c.id === action.cardId)
      if (i === -1) return fail(state, 'Carta não está na sua mão.')
      const card = state.hands[actor][i]
      const wouldEmpty = state.hands[actor].length === 1
      // só dá pra pegar o morto se a dupla ainda não pegou E ainda existe morto
      // (ele pode ter virado monte quando as compras acabaram)
      const podePegarMorto = !state.tookMorto[team] && state.mortos.length > 0

      if (wouldEmpty && !podePegarMorto && !hasCanastra(s0(state), team))
        return fail(state, 'Você precisa de pelo menos uma canastra para bater.')

      const s = clone(state)
      s.hands[actor].splice(i, 1)
      s.discard.push(card)
      // Trancam a mesa pra compra: 3 preto E coringa (2, de qualquer naipe).
      s.discardLocked = isBlackThree(card) || isWild(card)

      if (s.hands[actor].length === 0) {
        if (podePegarMorto) {
          // pega o morto e continua jogando
          s.hands[actor] = s.mortos.pop()!
          s.tookMorto[team] = true
          s.log.push(`${seatName(s, actor)} esvaziou a mão e pegou o morto.`)
          return ok(s) // turno continua
        }
        // bate!
        s.log.push(`${seatName(s, actor)} bateu! 🎉`)
        return endHand(s, team, seatName(s, actor))
      }

      // descarte normal: passa a vez
      s.turn = ((actor + 1) % 4) as Seat
      s.phase = 'draw'
      s.hasDrawn = false
      s.lastDrawn = null
      return ok(s)
    }
  }
}

const s0 = (s: GameState) => s // helper p/ leitura (evita clone só pra checar canastra)

/**
 * Garante carta no monte: se acabou, um MORTO vira monte (regra da casa — o morto
 * também é jogo). Retorna false só quando não há mais monte nem morto: aí a mão acaba.
 */
function refillStock(s: GameState): boolean {
  if (s.stock.length > 0) return true
  const morto = s.mortos.pop()
  if (!morto || morto.length === 0) return false
  s.stock = morto
  s.log.push('O monte acabou — o morto virou monte. 🔄')
  return true
}

/** Quando a mão de quem jogou esvazia ao BAIXAR (não no descarte): pega morto ou bate. */
function afterShrink(s: GameState, actor: Seat): GameState {
  const team = teamOf(actor)
  if (s.hands[actor].length > 0) return s
  if (!s.tookMorto[team] && s.mortos.length > 0) {
    s.hands[actor] = s.mortos.pop()!
    s.tookMorto[team] = true
    s.log.push(`${seatName(s, actor)} baixou tudo e pegou o morto.`)
    return s
  }
  if (hasCanastra(s, team)) {
    s.log.push(`${seatName(s, actor)} bateu baixando tudo! 🎉`)
    return endHand(s, team, seatName(s, actor)).state
  }
  return s // mão vazia, sem morto p/ pegar e sem canastra — segue (vai precisar de carta; caso de borda)
}

/** Encerra a mão: pontua as duas duplas, acumula e checa o alvo da partida. */
function endHand(s: GameState, batedor?: Team, batedorNome?: string): ApplyResult {
  const teams: Team[] = ['nos', 'eles']
  const extrato = {} as Record<Team, ReturnType<typeof scoreHandDetailed>>
  for (const t of teams) {
    const handCards = seatsOf(t).flatMap((seat) => s.hands[seat])
    const blackThrees = handCards.filter(isBlackThree).length
    const detalhe = scoreHandDetailed({
      melds: s.melds[t].map((m) => ({ cards: m.cards })),
      redThrees: s.redThrees[t].length,
      blackThreesInHand: blackThrees, // -100 por CADA 3 preto que sobrou
      tookMorto: s.tookMorto[t],
      hasBatted: batedor === t,
      cardsInHand: handCards.filter((c) => !isBlackThree(c)),
    })
    extrato[t] = detalhe
    s.scores[t] += detalhe.total
    s.log.push(
      `Dupla ${t === 'nos' ? 'Nós' : 'Eles'}: ${detalhe.total >= 0 ? '+' : ''}${detalhe.total} (total ${s.scores[t]})`,
    )
  }
  s.lastHand = {
    reason: batedor ? 'bateu' : 'monte',
    batedor,
    batedorNome,
    scores: extrato,
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

function seatName(s: GameState, seat: Seat): string {
  return s.players[seat]?.name ?? `Assento ${seat}`
}

export { dealHand }
