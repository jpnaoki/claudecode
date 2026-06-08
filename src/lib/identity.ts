// Identidade leve e persistente do jogador (sem login): um id estável + nome.
const KEY = 'tranca.identity'

export interface Identity {
  id: string
  name: string
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function getIdentity(): Identity {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  const fresh: Identity = { id: uuid(), name: '' }
  localStorage.setItem(KEY, JSON.stringify(fresh))
  return fresh
}

export function setName(name: string): Identity {
  const id = getIdentity()
  const next = { ...id, name: name.trim() }
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

/** Código de sala curto e legível (sem caracteres ambíguos). */
export function generateRoomCode(len = 4): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}
