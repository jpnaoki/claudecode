import { describe, it, expect } from 'vitest'
import { dealHand, Seat } from './state'
import { apply } from './engine'
import { nextBotAction } from './bot'

/**
 * O maior risco de um bot é TRAVAR (propor jogada inválida → motor rejeita →
 * estado não muda → vez nunca passa). Aqui 4 bots jogam mãos inteiras e a gente
 * garante: toda ação é válida e a mão SEMPRE termina.
 */
describe('auto-jogo dos bots', () => {
  const playHand = (dealer: Seat) => {
    let state = dealHand({ handNumber: 1, dealer, scores: { nos: 0, eles: 0 }, target: 3000 })
    let steps = 0
    const MAX = 5000
    while ((state.phase === 'draw' || state.phase === 'play') && steps < MAX) {
      const seat = state.turn
      const action = nextBotAction(state, seat)
      expect(action, `sem ação no passo ${steps}`).not.toBeNull()
      const res = apply(state, action!, seat)
      expect(res.error, `ação inválida do bot: ${JSON.stringify(action)} → ${res.error}`).toBeUndefined()
      state = res.state
      steps++
    }
    return { state, steps, MAX }
  }

  it('uma mão inteira termina sem jogada inválida', () => {
    const { state, steps, MAX } = playHand(3)
    expect(steps).toBeLessThan(MAX)
    expect(['handOver', 'matchOver']).toContain(state.phase)
  })

  it('20 mãos seguidas (dealers variados) nunca travam', () => {
    for (let g = 0; g < 20; g++) {
      const { state, steps, MAX } = playHand((g % 4) as Seat)
      expect(steps).toBeLessThan(MAX)
      expect(['handOver', 'matchOver']).toContain(state.phase)
    }
  })
})
