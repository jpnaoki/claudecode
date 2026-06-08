// Tipos de domínio da Tranca.
// Regras da casa: 2 baralhos (104 cartas, SEM Joker); os 2 são coringas; toda carta vale 10.

export type Suit = 'copas' | 'ouros' | 'espadas' | 'paus'

/** 'A'=Ás, 'J','Q','K' figuras, '2'..'10' numéricas. */
export type Rank =
  | 'A' | '2' | '3' | '4' | '5' | '6'
  | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

export interface Card {
  id: string // único na partida (há 2 baralhos, então usamos sufixo de cópia)
  suit: Suit
  rank: Rank
}

export const SUITS: Suit[] = ['copas', 'ouros', 'espadas', 'paus']
export const RED_SUITS: Suit[] = ['copas', 'ouros']
export const BLACK_SUITS: Suit[] = ['espadas', 'paus']

export const RANKS: Rank[] = [
  'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K',
]

/** Ordem para formar sequências do mesmo naipe (Ás baixo). A-2-3-...-K. */
export const SEQUENCE_ORDER: Rank[] = [
  'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K',
]

export const isRed = (c: Card): boolean => RED_SUITS.includes(c.suit)
export const isBlack = (c: Card): boolean => BLACK_SUITS.includes(c.suit)

/** O 2 é coringa (pode substituir qualquer carta numa sequência). */
export const isWild = (c: Card): boolean => c.rank === '2'

/** 3 vermelho: bônus automático (+100), nunca fica na mão. */
export const isRedThree = (c: Card): boolean => c.rank === '3' && isRed(c)

/** 3 preto: trava o lixo; não entra em sequência; -100 se bater com ele na mão. */
export const isBlackThree = (c: Card): boolean => c.rank === '3' && isBlack(c)
