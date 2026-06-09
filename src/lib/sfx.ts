// Sons curtos gerados na hora (Web Audio) — sem baixar arquivos. Discretos, à la jogo de cartas.
let ctx: AudioContext | null = null
let unlocked = false

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  return ctx
}

/** Destrava o áudio no primeiro toque (exigência do iOS). */
export function unlockAudio() {
  if (unlocked) return
  const c = ac()
  if (!c) return
  if (c.state === 'suspended') void c.resume()
  unlocked = true
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.04, delay = 0) {
  const c = ac()
  if (!c) return
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.value = freq
  o.connect(g)
  g.connect(c.destination)
  const t = c.currentTime + delay
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.start(t)
  o.stop(t + dur + 0.02)
}

export const sfx = {
  tap: () => tone(440, 0.06, 'sine', 0.02),
  play: () => {
    tone(523, 0.08, 'sine', 0.03)
    tone(659, 0.09, 'sine', 0.025, 0.05)
  },
  turn: () => {
    tone(587, 0.12, 'sine', 0.05)
    tone(880, 0.14, 'sine', 0.04, 0.12)
  },
  error: () => tone(160, 0.16, 'sawtooth', 0.025),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'sine', 0.05, i * 0.12)),
}

/** Vibração curta (Android; iOS ignora — sem problema). */
export function vibrate(ms: number) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* ignore */
  }
}
