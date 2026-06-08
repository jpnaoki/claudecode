import { Player } from '@/store/gameStore'
import PlayingCard from '@/components/PlayingCard'

interface Props {
  player: Player
  count: number
  active: boolean
  orientation?: 'horizontal' | 'vertical'
}

const initials = (name: string) =>
  name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

/** Assento de um adversário/parceiro: avatar, nome, dupla e leque de cartas viradas. */
export default function Seat({ player, count, active, orientation = 'horizontal' }: Props) {
  const teamColor = player.team === 'nos' ? 'text-brass-300' : 'text-ember-400'
  const mini = Array.from({ length: Math.min(count, 5) })

  return (
    <div
      className={`flex items-center gap-2 ${
        orientation === 'vertical' ? 'flex-col' : 'flex-row'
      }`}
    >
      <div className="relative">
        <div
          className={`grid h-10 w-10 place-items-center rounded-full border text-xs font-bold transition-all ${
            active
              ? 'border-brass-400 bg-felt-600 shadow-glow'
              : 'border-white/15 bg-black/30'
          }`}
        >
          {initials(player.name)}
        </div>
        {active && (
          <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-ember-500" />
        )}
      </div>

      <div className={orientation === 'vertical' ? 'text-center' : ''}>
        <div className="text-xs font-semibold leading-tight">{player.name}</div>
        <div className={`text-[10px] uppercase tracking-wider ${teamColor}`}>
          {player.team} · {count}
        </div>
      </div>

      <div className="flex">
        {mini.map((_, i) => (
          <div key={i} style={{ marginLeft: i ? -16 : 0 }}>
            <PlayingCard faceDown size="sm" className="!w-7 !h-10" />
          </div>
        ))}
      </div>
    </div>
  )
}
