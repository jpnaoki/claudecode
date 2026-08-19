import { describe, it, expect } from 'vitest'
import { Card, Rank, Suit } from '@/lib/types'
import { validateSequence, validateMeld, validateSet, isCanastra, isCanastraLimpa } from './sequence'
import { dealHand, GameState, Seat } from './state'
import { apply } from './engine'
import { scoreHand } from '@/lib/scoring'

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
    // 3 vermelhos NÃO saem no deal — ficam na mão; bônus começa vazio
    expect(redThrees).toBe(0)
    expect(totalMaos).toBe(44)
    expect(s.stock.length).toBe(38)
    expect(totalMaos + 22 + s.stock.length).toBe(104)
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

  // Regra da casa: o coringa também tranca — de QUALQUER naipe.
  it('descartar coringa (2) tranca o lixo, em qualquer naipe', () => {
    for (const suit of ['copas', 'ouros', 'espadas', 'paus'] as Suit[]) {
      const drawn = apply(base(), { type: 'draw' }, 1).state
      drawn.hands[1].unshift(c('2', suit, 7))
      const after = apply(drawn, { type: 'discard', cardId: `2-${suit}-7` }, 1)
      expect(after.state.discardLocked, `2 de ${suit} não trancou`).toBe(true)
    }
  })

  it('carta comum NÃO tranca o lixo', () => {
    const drawn = apply(base(), { type: 'draw' }, 1).state
    drawn.hands[1].unshift(c('9', 'ouros', 7))
    const after = apply(drawn, { type: 'discard', cardId: '9-ouros-7' }, 1)
    expect(after.state.discardLocked).toBe(false)
  })
})

describe('pegar o morto: descartando PERDE a vez, baixando tudo CONTINUA', () => {
  it('esvaziou DESCARTANDO a última: pega o morto e passa a vez', () => {
    const s = playState('morto-descarte') // turn = 1, phase = play
    s.hands[1] = [c('K', 'ouros', 5)] // só uma carta: vai descartar e esvaziar
    const r = apply(s, { type: 'discard', cardId: 'K-ouros-5' }, 1)
    expect(r.error).toBeUndefined()
    expect(r.state.tookMorto.eles).toBe(true)
    expect(r.state.hands[1].length).toBe(11) // recebeu o morto
    expect(r.state.turn).toBe(2) // PERDEU a vez
    expect(r.state.phase).toBe('draw')
  })

  it('esvaziou BAIXANDO tudo: pega o morto e continua jogando', () => {
    const s = playState('morto-baixando')
    s.hands[1] = [c('4', 'copas', 5), c('5', 'copas', 5), c('6', 'copas', 5)]
    const r = apply(s, { type: 'meld', cardIds: ['4-copas-5', '5-copas-5', '6-copas-5'] }, 1)
    expect(r.error).toBeUndefined()
    expect(r.state.tookMorto.eles).toBe(true)
    expect(r.state.hands[1].length).toBe(11) // recebeu o morto
    expect(r.state.turn).toBe(1) // CONTINUA na vez dele
    expect(r.state.phase).toBe('play')
  })
})

describe('3 vermelho não ressuscita as compras', () => {
  // Bug real: comprei a última carta (um 3 vermelho); ao baixá-lo, o motor abriu
  // um MORTO só pra dar a carta de reposição — e o adversário voltou a comprar.
  const naUltimaCarta = (mortos: number) => {
    const s = dealHand({ handNumber: 1, dealer: 0, scores: { nos: 0, eles: 0 }, target: 3000, seed: 'r3' })
    s.mortos = s.mortos.slice(0, mortos)
    s.tookMorto = { nos: true, eles: true }
    s.stock = []
    s.hands[1] = [c('3', 'copas', 77), c('K', 'ouros', 1), c('9', 'paus', 1)]
    s.turn = 1
    s.phase = 'play'
    s.hasDrawn = true
    return s
  }

  it('baixar 3 vermelho com monte vazio NÃO abre o morto', () => {
    const s = naUltimaCarta(1)
    const r = apply(s, { type: 'layRedThrees', cardIds: ['3-copas-77'] }, 1)
    expect(r.error).toBeUndefined()
    expect(r.state.redThrees.eles.length).toBe(1) // ganhou os +100
    expect(r.state.mortos.length).toBe(1) // o morto continua intacto
    expect(r.state.stock.length).toBe(0) // e o monte segue vazio
  })

  it('sem monte e sem morto, a mão acaba na compra seguinte', () => {
    const s = naUltimaCarta(0)
    const baixou = apply(s, { type: 'layRedThrees', cardIds: ['3-copas-77'] }, 1).state
    const desc = apply(baixou, { type: 'discard', cardId: 'K-ouros-1' }, 1).state
    const adv = apply(desc, { type: 'draw' }, desc.turn)
    expect(['handOver', 'matchOver']).toContain(adv.state.phase)
  })
})

describe('o morto também é jogo: vira monte quando as compras acabam', () => {
  const semMonte = (mortos: number) => {
    const s = dealHand({ handNumber: 1, dealer: 0, scores: { nos: 0, eles: 0 }, target: 3000, seed: 'morto' })
    s.stock = []
    s.mortos = s.mortos.slice(0, mortos)
    s.turn = 1
    s.phase = 'draw'
    s.hasDrawn = false
    return s
  }

  it('com morto sobrando, o monte é reabastecido e a mão CONTINUA', () => {
    const s = semMonte(2)
    const r = apply(s, { type: 'draw' }, 1)
    expect(r.error).toBeUndefined()
    expect(r.state.phase).toBe('play') // seguiu jogando
    expect(r.state.mortos.length).toBe(1) // um morto virou monte
    expect(r.state.stock.length).toBe(10) // 11 do morto menos a carta comprada
    expect(r.state.log.some((l) => l.includes('morto virou monte'))).toBe(true)
  })

  it('sem monte E sem morto, aí sim a mão acaba', () => {
    const s = semMonte(0)
    const r = apply(s, { type: 'draw' }, 1)
    expect(['handOver', 'matchOver']).toContain(r.state.phase)
    expect(r.state.lastHand?.reason).toBe('monte')
  })

  it('sem morto disponível, esvaziar a mão exige canastra (não trava)', () => {
    const s = dealHand({ handNumber: 1, dealer: 0, scores: { nos: 0, eles: 0 }, target: 3000, seed: 'z' })
    s.mortos = [] // já viraram monte
    s.turn = 1
    s.phase = 'play'
    s.hasDrawn = true
    s.hands[1] = [c('K', 'ouros', 3)]
    const r = apply(s, { type: 'discard', cardId: 'K-ouros-3' }, 1)
    expect(r.error).toBeTruthy() // sem canastra não pode bater
  })
})

describe('penalidade do 3 preto (-100 por CADA)', () => {
  const semNada = {
    melds: [],
    redThrees: 0,
    tookMorto: true,
    hasBatted: false,
    cardsInHand: [],
  }
  it('cobra -100 por cada 3 preto que sobrou na mão', () => {
    expect(scoreHand({ ...semNada, blackThreesInHand: 0 })).toBe(0)
    expect(scoreHand({ ...semNada, blackThreesInHand: 1 })).toBe(-100)
    expect(scoreHand({ ...semNada, blackThreesInHand: 2 })).toBe(-200)
    expect(scoreHand({ ...semNada, blackThreesInHand: 4 })).toBe(-400)
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

const playState = (seed: string) => {
  const s = dealHand({ handNumber: 1, dealer: 0, scores: { nos: 0, eles: 0 }, target: 3000, seed })
  s.turn = 1
  s.phase = 'play'
  s.hasDrawn = true
  return s
}

describe('coringa de naipe diferente na sequência (bug do usuário)', () => {
  it('validateSequence aceita Q♣ K♣ + 2♥ + A♣', () => {
    expect(
      validateSequence([c('Q', 'paus'), c('K', 'paus'), c('2', 'copas'), c('A', 'paus')]).ok,
    ).toBe(true)
  })
  it('addToMeld: adiciona A♣ a um jogo Q♣ K♣ 2♥', () => {
    const s = playState('wild')
    s.melds.eles = [{ id: 'm1', cards: [c('Q', 'paus'), c('K', 'paus'), c('2', 'copas')] }]
    s.hands[1] = [c('A', 'paus')]
    const r = apply(s, { type: 'addToMeld', meldId: 'm1', cardIds: ['A-paus-0'] }, 1)
    expect(r.error).toBeUndefined()
    expect(r.state.melds.eles[0].cards.length).toBe(4)
  })
  it('no máximo 1 coringa por jogo', () => {
    expect(validateSequence([c('4', 'copas'), c('5', 'copas'), c('2', 'espadas'), c('2', 'ouros')]).ok).toBe(false)
    expect(validateSet([c('4', 'copas'), c('2', 'espadas'), c('2', 'ouros')]).ok).toBe(false)
  })
})

describe('trincas (cartas de mesmo valor)', () => {
  it('aceita 4-4-4 e A-A-A', () => {
    expect(validateSet([c('4', 'copas'), c('4', 'espadas'), c('4', 'ouros')]).ok).toBe(true)
    expect(validateSet([c('A', 'copas'), c('A', 'espadas'), c('A', 'paus')]).ok).toBe(true)
    expect(validateMeld([c('4', 'copas'), c('4', 'espadas'), c('4', 'ouros')]).ok).toBe(true)
  })
  it('aceita trinca com coringa (4-4-2)', () => {
    expect(validateSet([c('4', 'copas'), c('4', 'espadas'), c('2', 'ouros')]).ok).toBe(true)
  })
  it('rejeita valores misturados e o 3', () => {
    expect(validateSet([c('4', 'copas'), c('5', 'espadas'), c('4', 'ouros')]).ok).toBe(false)
    expect(validateSet([c('3', 'copas'), c('3', 'espadas'), c('3', 'ouros')]).ok).toBe(false)
  })

  // REGRA DA CASA: lavadeira SÓ com 4 e Ás. Um bot chegou a baixar 3 reis — nunca mais.
  it('REJEITA lavadeira de qualquer outro valor (K, Q, J, 10, 7…)', () => {
    const outros: Rank[] = ['K', 'Q', 'J', '10', '9', '8', '7', '6', '5']
    for (const r of outros) {
      const trinca = [c(r, 'copas'), c(r, 'espadas'), c(r, 'ouros')]
      expect(validateSet(trinca).ok, `validateSet aceitou ${r}-${r}-${r}`).toBe(false)
      expect(validateMeld(trinca).ok, `validateMeld aceitou ${r}-${r}-${r}`).toBe(false)
      // nem com coringa
      expect(validateMeld([c(r, 'copas'), c(r, 'espadas'), c('2', 'ouros')]).ok).toBe(false)
    }
  })

  it('o motor recusa baixar 3 reis (o bug relatado)', () => {
    const s = playState('set')
    s.hands[1] = [c('K', 'copas'), c('K', 'espadas'), c('K', 'ouros'), c('7', 'paus')]
    const r = apply(s, { type: 'meld', cardIds: ['K-copas-0', 'K-espadas-0', 'K-ouros-0'] }, 1)
    expect(r.error).toBeTruthy()
    expect(r.state.melds.eles.length).toBe(0)
  })
  it('baixa uma trinca e encaixa até a canastra', () => {
    const s = playState('set')
    s.hands[1] = [c('A', 'copas'), c('A', 'espadas'), c('A', 'paus'), c('A', 'ouros')]
    const r = apply(s, { type: 'meld', cardIds: ['A-copas-0', 'A-espadas-0', 'A-paus-0'] }, 1)
    expect(r.error).toBeUndefined()
    expect(r.state.melds.eles.length).toBe(1)
    const r2 = apply(r.state, { type: 'addToMeld', meldId: r.state.melds.eles[0].id, cardIds: ['A-ouros-0'] }, 1)
    expect(r2.error).toBeUndefined()
    expect(r2.state.melds.eles[0].cards.length).toBe(4)
  })
})

describe('3 vermelho manual', () => {
  it('baixar 3 vermelho dá +100 e compra extra (mantém o tamanho da mão)', () => {
    const s = playState('r3')
    s.hands[1] = [c('3', 'copas', 5), c('K', 'ouros'), c('4', 'paus')]
    const before = s.stock.length
    const r = apply(s, { type: 'layRedThrees', cardIds: ['3-copas-5'] }, 1)
    expect(r.error).toBeUndefined()
    expect(r.state.redThrees.eles.length).toBe(1)
    expect(r.state.hands[1].length).toBe(3) // tirou o 3, comprou 1
    expect(r.state.stock.length).toBe(before - 1)
  })
  it('rejeita baixar 3 preto como vermelho', () => {
    const s = playState('r3b')
    s.hands[1] = [c('3', 'espadas', 5), c('K', 'ouros')]
    expect(apply(s, { type: 'layRedThrees', cardIds: ['3-espadas-5'] }, 1).error).toBeTruthy()
  })
})

describe('pegar o lixo (restrição)', () => {
  const draw = (s: ReturnType<typeof playState>) => {
    s.phase = 'draw'
    s.hasDrawn = false
    return s
  }
  it('rejeita se o topo não casa com nada', () => {
    const s = draw(playState('lx1'))
    s.discard = [c('K', 'ouros', 7)]
    s.hands[1] = [c('4', 'copas'), c('9', 'espadas'), c('A', 'paus')]
    expect(apply(s, { type: 'takeDiscard' }, 1).error).toBeTruthy()
  })
  it('permite (baixando o topo) se forma sequência com a mão', () => {
    const s = draw(playState('lx2'))
    s.discard = [c('6', 'copas', 7)]
    s.hands[1] = [c('4', 'copas'), c('5', 'copas'), c('K', 'ouros')]
    const r = apply(s, { type: 'takeDiscard', meldWith: ['4-copas-0', '5-copas-0'] }, 1)
    expect(r.error).toBeUndefined()
    expect(r.state.discard.length).toBe(0)
    expect(r.state.melds.eles.length).toBe(1) // baixou o topo na hora
  })
  it('rejeita pegar sem baixar o topo (regra rígida)', () => {
    const s = draw(playState('lx2b'))
    s.discard = [c('6', 'copas', 7)]
    s.hands[1] = [c('4', 'copas'), c('5', 'copas'), c('K', 'ouros')]
    expect(apply(s, { type: 'takeDiscard' }, 1).error).toBeTruthy()
  })
  it('permite se o topo encaixa num jogo baixado', () => {
    const s = draw(playState('lx3'))
    s.discard = [c('7', 'copas', 7)]
    s.melds.eles = [{ id: 'm1', cards: [c('4', 'copas'), c('5', 'copas'), c('6', 'copas')] }]
    s.hands[1] = [c('K', 'ouros')]
    expect(apply(s, { type: 'takeDiscard' }, 1).error).toBeUndefined()
  })
})
