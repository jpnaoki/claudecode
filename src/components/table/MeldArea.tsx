import { Card } from '@/lib/types'
import PlayingCard from '@/components/PlayingCard'
import { isCanastra, isCanastraLimpa } from '@/lib/scoring'

function MeldRow({ cards }: { cards: Card[] }) {
  const canastra = isCanastra({ cards })
  const limpa = isCanastraLimpa({ cards })
  return (
    <div className="relative flex shrink-0 items-center rounded-lg bg-black/15 p-1 pr-2">
      {cards.map((c, i) => (
        <div key={c.id} style={{ marginLeft: i ? -28 : 0 }}>
          <PlayingCard card={c} size="sm" />
        </div>
      ))}
      {canastra && (
        <span
          className={`ml-2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
            limpa ? 'bg-brass-400 text-ink' : 'bg-white/20 text-bone-100'
          }`}
        >
          {limpa ? 'limpa 200' : 'suja 100'}
        </span>
      )}
    </div>
  )
}

interface Props {
  label: string
  melds: Card[][]
  redThrees: Card[]
}

/** Área de jogos baixados de uma dupla (sequências + 3 vermelhos). */
export default function MeldArea({ label, melds, redThrees }: Props) {
  const empty = melds.length === 0 && redThrees.length === 0
  return (
    <div className="rounded-xl border border-white/5 bg-black/10 p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-bone-200/50">{label}</span>
        {redThrees.length > 0 && (
          <span className="rounded-full bg-suit-red/80 px-2 py-0.5 text-[9px] font-bold text-white">
            {redThrees.length} × 3♥ (+{redThrees.length * 100})
          </span>
        )}
      </div>
      {empty ? (
        <div className="py-3 text-center text-[11px] text-bone-200/30">sem jogos ainda</div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {melds.map((m, i) => (
            <MeldRow key={i} cards={m} />
          ))}
        </div>
      )}
    </div>
  )
}
