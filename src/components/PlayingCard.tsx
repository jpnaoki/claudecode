import { Card, Rank, Suit, isRed, isWild } from '@/lib/types'

const SUIT_GLYPH: Record<Suit, string> = {
  copas: '♥',
  ouros: '♦',
  espadas: '♠',
  paus: '♣',
}

type Size = 'sm' | 'md' | 'lg'
const SIZES: Record<Size, string> = {
  sm: 'w-12 h-[68px] rounded-lg',
  md: 'w-16 h-24 rounded-xl',
  lg: 'w-24 h-36 rounded-2xl',
}
const INDEX_TEXT: Record<Size, string> = {
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-base',
}
const PIP_TEXT: Record<Size, string> = {
  sm: 'text-[9px]',
  md: 'text-[13px]',
  lg: 'text-xl',
}
const COURT_TEXT: Record<Size, string> = {
  sm: 'text-xl',
  md: 'text-3xl',
  lg: 'text-5xl',
}

// Layout clássico de pips: [coluna 0|1|2, linha 0..1].
const COL = [0.28, 0.5, 0.72]
const PIPS: Record<string, [number, number][]> = {
  A: [[1, 0.5]],
  '2': [[1, 0.18], [1, 0.82]],
  '3': [[1, 0.18], [1, 0.5], [1, 0.82]],
  '4': [[0, 0.18], [2, 0.18], [0, 0.82], [2, 0.82]],
  '5': [[0, 0.18], [2, 0.18], [1, 0.5], [0, 0.82], [2, 0.82]],
  '6': [[0, 0.18], [2, 0.18], [0, 0.5], [2, 0.5], [0, 0.82], [2, 0.82]],
  '7': [[0, 0.18], [2, 0.18], [1, 0.34], [0, 0.5], [2, 0.5], [0, 0.82], [2, 0.82]],
  '8': [[0, 0.18], [2, 0.18], [1, 0.34], [0, 0.5], [2, 0.5], [1, 0.66], [0, 0.82], [2, 0.82]],
  '9': [
    [0, 0.16], [2, 0.16], [0, 0.38], [2, 0.38], [1, 0.5],
    [0, 0.62], [2, 0.62], [0, 0.84], [2, 0.84],
  ],
  '10': [
    [0, 0.16], [2, 0.16], [1, 0.28], [0, 0.38], [2, 0.38],
    [0, 0.62], [2, 0.62], [1, 0.72], [0, 0.84], [2, 0.84],
  ],
}

const isCourt = (r: Rank) => r === 'J' || r === 'Q' || r === 'K'

interface Props {
  card?: Card
  faceDown?: boolean
  size?: Size
  selected?: boolean
  onClick?: () => void
  className?: string
}

/** Carta de baralho premium — pips clássicos, índices nos cantos, filete dourado. */
export default function PlayingCard({
  card,
  faceDown,
  size = 'md',
  selected,
  onClick,
  className = '',
}: Props) {
  const base = `relative shrink-0 select-none ${SIZES[size]} shadow-card transition-transform duration-150 ${
    onClick ? 'cursor-pointer hover:-translate-y-2 hover:shadow-card-lift active:translate-y-0' : ''
  } ${selected ? '-translate-y-3 ring-2 ring-brass-400 shadow-card-lift' : ''} ${className}`

  if (faceDown || !card) {
    return (
      <div
        onClick={onClick}
        className={`${base} overflow-hidden border border-brass-600/60`}
        style={{ background: 'repeating-linear-gradient(45deg, #0A3D2A 0 6px, #0E5236 6px 12px)' }}
      >
        <div className="absolute inset-1 rounded-[inherit] border border-brass-500/40" />
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-display text-lg text-brass-400/80">T</span>
        </div>
      </div>
    )
  }

  const red = isRed(card)
  const color = red ? 'text-suit-red' : 'text-suit-black'
  const glyph = SUIT_GLYPH[card.suit]
  const pips = PIPS[card.rank] ?? []

  return (
    <div
      onClick={onClick}
      className={`${base} overflow-hidden bg-gradient-to-br from-bone-50 to-bone-200 border border-black/10`}
    >
      <div className="absolute inset-[3px] rounded-[inherit] ring-1 ring-brass-500/25" />

      {/* índice superior esquerdo */}
      <div className={`absolute left-1 top-0.5 flex flex-col items-center leading-none ${color} font-sans font-bold ${INDEX_TEXT[size]}`}>
        <span>{card.rank}</span>
        <span className="-mt-0.5">{glyph}</span>
      </div>
      {/* índice inferior direito (invertido) */}
      <div className={`absolute bottom-0.5 right-1 flex rotate-180 flex-col items-center leading-none ${color} font-sans font-bold ${INDEX_TEXT[size]}`}>
        <span>{card.rank}</span>
        <span className="-mt-0.5">{glyph}</span>
      </div>

      {/* miolo */}
      {isCourt(card.rank) ? (
        <div className="absolute inset-0 grid place-items-center">
          <div className={`flex flex-col items-center ${color}`}>
            <span className={`font-display font-semibold leading-none ${COURT_TEXT[size]}`}>
              {card.rank}
            </span>
            <span className={size === 'lg' ? 'text-2xl' : 'text-base'}>{glyph}</span>
          </div>
        </div>
      ) : (
        <div className="absolute inset-x-2 inset-y-3">
          {pips.map(([c, r], i) => (
            <span
              key={i}
              className={`absolute -translate-x-1/2 -translate-y-1/2 leading-none ${color} ${PIP_TEXT[size]} ${
                r > 0.5 ? 'rotate-180' : ''
              }`}
              style={{ left: `${COL[c] * 100}%`, top: `${r * 100}%` }}
            >
              {glyph}
            </span>
          ))}
        </div>
      )}

      {/* marca de coringa (2) */}
      {isWild(card) && (
        <div className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ember-500 text-[9px] font-bold text-white shadow-glow">
          C
        </div>
      )}
    </div>
  )
}
