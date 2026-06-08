import { describe, it, expect } from 'vitest'
import { Card, Rank, Suit } from '@/lib/types'
import { validateSequence, isCanastra, isCanastraLimpa } from './sequence'
import { dealHand, GameState, Seat } from './state'
import { apply } from './engine'

// helper p/ criar cartas
const c = (rank: Rank, suit: Suit, n = 0): Card => ({ id: `${rank}-${suit}-${n}`, rank, suit })

describe('validateSequence', () => {
  it('aceita sequência simples do mesmo naipe', () => {
    expect(validateSequence([c('4', 'copas'), c('5', 'copas'), c('6', 'copas')]).ok).toBe(true)
  })
  it('rejeita menos de 3 cartas', () => {
    expect(validateSequence([c('4', 'copas'), c('5', 'copas')]).ok).toBe(false)
  })
  it('rejeita naipes diferentes', () => {
    expect(validateSequence([c('4', 'copas'), c('5', 'ouros'), c('6', 'copas')]).ok).toBe(false)
  })
  it('rejeita ranks não consecutivos', () => {
    expect(validateSequence([c('4', 'copas'), c('6', 'copas'), c('8', 'copas')]).ok).toBe(false)
  })
  it('usa o 2 como coringa pra preencher lacuna', () => {
    // 4♥ _ 6♥ com 2♠ coringa no lugar do 5
    expect(validateSequence([c('4', 'copas'), c('6', 'copas'), c('2', 'espadas')]).ok).toBe(true)
  })
  it('Ás é alto: Q-K-A vale, mas A-2-3 não (por causa do 3)', () => {
    expect(validateSequence([c('Q', 'ouros'), c('K', 'ouros'), c('A', 'ouros')]).ok).toBe(true)
    expect(validateSequence([c('A', 'paus'), c('2', 'paus'), c('3', 'paus')]).ok).toBe(false)
  })
  it('rejeita QUALQUER 3 na sequência (vermelho E preto)', () => {
    expect(validateSequence([c('3', 'espadas'), c('4', 'espadas'), c('5', 'espadas')]).ok).toBe(false)
    expect(validateSequence([c('3', 'copas'), c('4', 'copas'), c('5', 'copas')]).ok).toBe(false)
    expect(validateSequence([c('4', 'copas'), c('5', 'copas'), c('3', 'copas')]).ok).toBe(false)
  })
  it('K-A + coringa vale como Q-K-A (não é "dar a volta")', () => {
    expect(validateSequence([c('K', 'paus'), c('A', 'paus'), c('2', 'paus', 1)]).ok).toBe(true)
  })
  it('detecta canastra limpa e suja', () => {
    const limpa = [c('4', 'copas'), c('5', 'copas'), c('6', 'copas'), c('7', 'copas'), c('8', 'copas'), c('9', 'copas'), c('10', 'copas')]
    expect(validateSequence(limpa).ok).toBe(true)
    expect(isCanastra(limpa)).toBe(true)
    expect(isCanastraLimpa(limpa)).toBe(true)
    const suja = [...limpa.slice(0, 6), c('2', 'espadas')]
    expect(isCanastraLimpa(suja)).toBe(false)
  })
})

describe('dealHand', () => {
  it('distribui 11 por jogador, 2 mortos de 11 e o resto no monte', () => {
    const s = dealHand({ handNumber: 1, dealer: 0, scores: { nos: 0, eles: 0 }, target: 3000, seed: 'abc' })
    const totalMaos = [0, 1, 2, 3].reduce((n, seat) => n + s.hands[seat as Seat].length, 0)
    const redThrees = s.redThrees.nos.length + s.redThrees.eles.length
    expect(s.mortos.length).toBe(2)
    expect(s.mortos[0].length).toBe(11)
    expect(s.mortos[1].length).toBe(11)
    // mãos somam 44 (3 vermelhos foram repostos por outras cartas)
    expect(totalMaos).toBe(44)
    // total de cartas conservado: 44 mãos + 22 mortos + monte + 3vermelhos baixados = 104
    expect(totalMaos + 22 + s.stock.length + redThrees).toBe(104)
    expect(s.turn).toBe(1) // dealer 0 → joga o assento 1
    expect(s.phase).toBe('draw')
  })
})

describe('fluxo de turno', () => {
  const base = (): GameState =>
    dealHand({ handNumber: 1, dealer: 0, scores: { nos: 0, eles: 0 }, target: 3000, seed: 'fluxo' })

  it('rejeita ação de quem não é a vez', () => {
    const s = base() // vez do assento 1
    const r = apply(s, { type: 'draw' }, 0)
    expect(r.error).toBeTruthy()
  })
  it('comprar move pra fase de jogo e impede comprar de novo', () => {
    const s = base()
    const r1 = apply(s, { type: 'draw' }, 1)
    expect(r1.error).toBeUndefined()
    expect(r1.state.phase).toBe('play')
    expect(r1.state.hasDrawn).toBe(true)
    const r2 = apply(r1.state, { type: 'draw' }, 1)
    expect(r2.error).toBeTruthy()
  })
  it('descartar passa a vez pro próximo', () => {
    const s = base()
    const drawn = apply(s, { type: 'draw' }, 1).state
    const cardId = drawn.hands[1][0].id
    const after = apply(drawn, { type: 'discard', cardId }, 1)
    expect(after.error).toBeUndefined()
    expect(after.state.turn).toBe(2)
    expect(after.state.phase).toBe('draw')
    expect(after.state.discard.length).toBe(1)
  })
  it('descartar 3 preto tranca o lixo', () => {
    const s = base()
    const drawn = apply(s, { type: 'draw' }, 1).state
    drawn.hands[1].unshift(c('3', 'espadas', 9)) // garante um 3 preto na mão
    const after = apply(drawn, { type: 'discard', cardId: '3-espadas-9' }, 1)
    expect(after.state.discardLocked).toBe(true)
  })
})

describe('baixar sequência', () => {
  it('baixa sequência válida e remove da mão', () => {
    const s = dealHand({ handNumber: 1, dealer: 0, scores: { nos: 0, eles: 0 }, target: 3000, seed: 'meld' })
    s.turn = 1
    s.phase = 'play'
    s.hasDrawn = true
    s.hands[1] = [c('4', 'copas'), c('5', 'copas'), c('6', 'copas'), c('K', 'ouros')]
    const r = apply(s, { type: 'meld', cardIds: ['4-copas-0', '5-copas-0', '6-copas-0'] }, 1)
    expect(r.error).toBeUndefined()
    expect(r.state.melds.eles.length).toBe(1)
    expect(r.state.hands[1].length).toBe(1)
  })
  it('rejeita baixar sequência inválida', () => {
    const s = dealHand({ handNumber: 1, dealer: 0, scores: { nos: 0, eles: 0 }, target: 3000, seed: 'meld2' })
    s.turn = 1
    s.phase = 'play'
    s.hasDrawn = true
    s.hands[1] = [c('4', 'copas'), c('7', 'copas'), c('K', 'ouros')]
    const r = apply(s, { type: 'meld', cardIds: ['4-copas-0', '7-copas-0', 'K-ouros-0'] }, 1)
    expect(r.error).toBeTruthy()
  })
})
