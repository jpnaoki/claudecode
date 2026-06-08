import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMatch } from '@/store/matchStore'
import { useRoom } from '@/store/roomStore'
import { getIdentity } from '@/lib/identity'
import { Seat, teamOf, GameState } from '@/engine/state'
import { isCanastra, isCanastraLimpa } from '@/engine/sequence'
import { Card, isWild } from '@/lib/types'
import PlayingCard from '@/components/PlayingCard'
import Button from '@/components/ui/Button'
import EmoteBar from '@/components/social/EmoteBar'
import SocialLayer from '@/components/social/SocialLayer'

const initials = (name: string) =>
  name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

const SUIT_SORT: Record<string, number> = { copas: 0, espadas: 1, ouros: 2, paus: 3 }
const RANK_SORT: Record<string, number> = {
  A: 14, K: 13, Q: 12, J: 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2,
}
/** Ordena por naipe e valor (coringas ao fim) — pro botão "organizar". */
function sortedHandIds(cards: Card[]): string[] {
  return [...cards]
    .sort((a, b) => {
      const wa = isWild(a)
      const wb = isWild(b)
      if (wa !== wb) return wa ? 1 : -1
      if (a.suit !== b.suit) return (SUIT_SORT[a.suit] ?? 9) - (SUIT_SORT[b.suit] ?? 9)
      return (RANK_SORT[a.rank] ?? 0) - (RANK_SORT[b.rank] ?? 0)
    })
    .map((c) => c.id)
}

export default function Table() {
  const navigate = useNavigate()
  const state = useMatch((s) => s.state)
  const mySeat = useMatch((s) => s.mySeat)
  const local = useMatch((s) => s.local)
  const error = useMatch((s) => s.error)
  const act = useMatch((s) => s.act)
  const leaveMatch = useMatch((s) => s.leave)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Decide online x local + reconexão (volta pela sala salva)
  useEffect(() => {
    const room = useRoom.getState()
    const me = getIdentity()
    let code = room.code
    if (!code) {
      const saved = localStorage.getItem('tranca.room')
      if (saved && me.name) {
        code = saved
        room.connect(saved, me)
      }
    }
    const m = useMatch.getState()
    if (code && me.name) {
      if (m.code !== code || !m.state) m.join(code, me.id)
    } else if (!m.state) {
      m.startLocal()
    }
  }, [])

  const viewSeat: Seat | null = local && state ? state.turn : mySeat
  const isMyTurn = !!state && (local || (mySeat != null && state.turn === mySeat))

  // limpa seleção ao trocar de quem joga
  useEffect(() => setSelected(new Set()), [state?.turn, viewSeat])

  // ordem de exibição da mão (local, por aparelho) — preserva organização e anexa cartas novas
  const [order, setOrder] = useState<string[]>([])
  useEffect(() => {
    if (viewSeat == null || !state) return
    const ids = state.hands[viewSeat].map((c) => c.id)
    setOrder((prev) => {
      const keep = prev.filter((id) => ids.includes(id))
      const added = ids.filter((id) => !keep.includes(id))
      const next = [...keep, ...added]
      return next.length === prev.length && next.every((x, i) => x === prev[i]) ? prev : next
    })
  }, [state, viewSeat])

  if (!state) {
    return (
      <div className="grid min-h-full place-items-center px-6 text-center">
        <div>
          <div className="animate-pulse font-display text-2xl text-gold">Preparando a mesa…</div>
          <p className="mt-2 text-sm text-bone-200/60">conectando à partida</p>
        </div>
      </div>
    )
  }

  const leave = () => {
    leaveMatch()
    useRoom.getState().disconnect()
    localStorage.removeItem('tranca.room')
    navigate('/')
  }

  const rel = (off: number) => (((viewSeat ?? 0) + off) % 4) as Seat
  const bottom = viewSeat ?? 0
  const left = rel(1)
  const top = rel(2)
  const right = rel(3)

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const ids = [...selected]
  const myTeam = teamOf(bottom)
  const topDiscard = state.discard[state.discard.length - 1]

  const viewHand = viewSeat != null ? state.hands[viewSeat] : []
  const byId = new Map(viewHand.map((c) => [c.id, c]))
  const orderedHand = order.map((id) => byId.get(id)).filter(Boolean) as Card[]
  const hand = orderedHand.length === viewHand.length ? orderedHand : viewHand
  const organize = () => viewSeat != null && setOrder(sortedHandIds(state.hands[viewSeat]))

  const doMeld = () => {
    act({ type: 'meld', cardIds: ids })
    setSelected(new Set())
  }
  const doDiscard = () => {
    if (ids.length !== 1) return
    act({ type: 'discard', cardId: ids[0] })
    setSelected(new Set())
  }
  const addTo = (meldId: string) => {
    if (ids.length === 0) return
    act({ type: 'addToMeld', meldId, cardIds: ids })
    setSelected(new Set())
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-3 pb-3">
      <SocialLayer />

      {/* topo */}
      <header className="flex items-center justify-between py-2">
        <button onClick={leave} className="text-xs uppercase tracking-widest text-brass-400/70">
          ← sair
        </button>
        <div className="panel flex items-center gap-4 rounded-full px-4 py-1.5">
          <ScoreBadge label="Nós" value={state.scores.nos} accent active={myTeam === 'nos'} />
          <div className="h-5 w-px bg-white/10" />
          <ScoreBadge label="Eles" value={state.scores.eles} active={myTeam === 'eles'} />
        </div>
        <span className="text-[10px] uppercase tracking-widest text-bone-200/40">
          mão {state.handNumber}
        </span>
      </header>

      <TurnBanner state={state} isMyTurn={isMyTurn} local={local} />

      {/* parceiro (topo) */}
      <div className="flex justify-center py-1">
        <SeatChip state={state} seat={top} />
      </div>

      {/* meio: oponentes + centro */}
      <div className="my-2 grid grid-cols-[auto_1fr_auto] items-center gap-1">
        <SeatChip state={state} seat={left} vertical />

        <div
          className="flex items-center justify-center gap-3 rounded-[1.4rem] border border-brass-500/25 py-4"
          style={{
            background: 'radial-gradient(120% 140% at 50% 0%, rgba(20,120,78,.45), rgba(0,0,0,.28))',
            boxShadow: 'inset 0 2px 10px rgba(0,0,0,.45)',
          }}
        >
          <Pile label={`monte ${state.stock.length}`}>
            <PlayingCard faceDown size="md" />
          </Pile>
          <Pile label={state.discardLocked ? '🔒 lixo' : `lixo ${state.discard.length}`}>
            {topDiscard ? (
              <PlayingCard card={topDiscard} size="md" />
            ) : (
              <div className="grid h-24 w-16 place-items-center rounded-xl border border-dashed border-white/15 text-[10px] text-bone-200/30">
                vazio
              </div>
            )}
          </Pile>
          <Pile label={`mortos ${state.mortos.length}`}>
            <div className="relative">
              <PlayingCard faceDown size="md" className="!w-12" />
              {state.mortos.length > 1 && (
                <div className="absolute -right-2 -top-1">
                  <PlayingCard faceDown size="md" className="!w-12" />
                </div>
              )}
            </div>
          </Pile>
        </div>

        <SeatChip state={state} seat={right} vertical />
      </div>

      {/* jogos das duplas */}
      <div className="space-y-2">
        <TeamMelds
          state={state}
          team={myTeam}
          label="Nossos jogos"
          onMeldClick={ids.length ? addTo : undefined}
        />
        <TeamMelds state={state} team={myTeam === 'nos' ? 'eles' : 'nos'} label="Jogos deles" />
      </div>

      <div className="flex-1" />

      {/* minha mão */}
      {viewSeat != null && (
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-[10px] uppercase tracking-widest text-bone-200/50">
              {local ? `Mão de ${state.players[viewSeat]?.name ?? viewSeat}` : 'Sua mão'} ·{' '}
              {state.hands[viewSeat].length}
            </span>
            <div className="flex items-center gap-3">
              {selected.size > 0 && (
                <span className="text-[10px] text-brass-300">{selected.size} selecionada(s)</span>
              )}
              <button
                onClick={organize}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-brass-300 transition-colors hover:bg-white/10"
              >
                ⇄ organizar
              </button>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-y-2 pt-2">
            {hand.map((c, i) => (
              <div key={c.id} style={{ marginLeft: i ? -14 : 0 }}>
                <PlayingCard
                  card={c}
                  size="md"
                  selected={selected.has(c.id)}
                  onClick={() => toggle(c.id)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ações */}
      <div className="mt-2 flex gap-2">
        {state.phase === 'draw' ? (
          <>
            <Button variant="gold" className="flex-1 !px-2" disabled={!isMyTurn || state.hasDrawn} onClick={() => act({ type: 'draw' })}>
              Comprar
            </Button>
            <Button
              variant="primary"
              className="flex-1 !px-2"
              disabled={!isMyTurn || state.hasDrawn || state.discard.length === 0 || state.discardLocked}
              onClick={() => act({ type: 'takeDiscard' })}
            >
              Pegar lixo
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" className="flex-1 !px-2" disabled={!isMyTurn || selected.size < 3} onClick={doMeld}>
              Baixar
            </Button>
            <Button variant="gold" className="flex-1 !px-2" disabled={!isMyTurn || selected.size !== 1} onClick={doDiscard}>
              Descartar
            </Button>
          </>
        )}
      </div>

      {/* reações */}
      <div className="mt-2 flex justify-center">
        <EmoteBar compact />
      </div>

      {/* toast de erro */}
      {error && (
        <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4">
          <div className="rounded-xl border border-ember-500/40 bg-ember-600/90 px-4 py-2 text-sm font-semibold text-white shadow-card-lift">
            {error}
          </div>
        </div>
      )}

      {/* fim de mão / fim de jogo */}
      {(state.phase === 'handOver' || state.phase === 'matchOver') && (
        <EndOverlay state={state} canAdvance={local || mySeat === 0} onNext={() => act({ type: 'nextHand' })} onLeave={leave} />
      )}
    </div>
  )
}

function ScoreBadge({ label, value, accent, active }: { label: string; value: number; accent?: boolean; active?: boolean }) {
  return (
    <div className={`text-center ${active ? '' : 'opacity-70'}`}>
      <div className={`text-[9px] uppercase tracking-widest ${accent ? 'text-brass-300' : 'text-ember-400'}`}>{label}</div>
      <div className="font-display text-lg leading-none">{value}</div>
    </div>
  )
}

function TurnBanner({ state, isMyTurn, local }: { state: GameState; isMyTurn: boolean; local: boolean }) {
  const name = state.players[state.turn]?.name ?? `Assento ${state.turn}`
  const phaseTxt = state.phase === 'draw' ? 'comprar' : 'jogar/descartar'
  return (
    <div
      className={`flex items-center justify-center gap-2 rounded-full py-1 text-xs ${
        isMyTurn ? 'bg-brass-500/15 text-brass-200' : 'text-bone-200/50'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${isMyTurn ? 'animate-pulse bg-ember-500' : 'bg-white/20'}`} />
      {local ? `Vez de ${name} · ${phaseTxt}` : isMyTurn ? `Sua vez · ${phaseTxt}` : `Vez de ${name}`}
    </div>
  )
}

function SeatChip({ state, seat, vertical }: { state: GameState; seat: Seat; vertical?: boolean }) {
  const p = state.players[seat]
  const count = state.hands[seat].length
  const active = state.turn === seat
  const team = teamOf(seat)
  const mini = Array.from({ length: Math.min(count, 4) })
  return (
    <div className={`flex items-center gap-2 ${vertical ? 'flex-col' : ''}`}>
      <div className={`grid h-9 w-9 place-items-center rounded-full border text-xs font-bold ${active ? 'border-brass-400 bg-felt-600 shadow-glow' : 'border-white/15 bg-black/30'}`}>
        {p ? initials(p.name) : '—'}
      </div>
      <div className={vertical ? 'text-center' : ''}>
        <div className="max-w-[70px] truncate text-xs font-semibold">{p?.name ?? 'vazio'}</div>
        <div className={`text-[10px] uppercase ${team === 'nos' ? 'text-brass-300' : 'text-ember-400'}`}>
          {team} · {count}
        </div>
      </div>
      <div className="flex">
        {mini.map((_, i) => (
          <div key={i} style={{ marginLeft: i ? -14 : 0 }}>
            <PlayingCard faceDown size="sm" className="!h-9 !w-6" />
          </div>
        ))}
      </div>
    </div>
  )
}

function Pile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {children}
      <span className="text-[10px] uppercase tracking-wider text-bone-200/50">{label}</span>
    </div>
  )
}

function TeamMelds({
  state,
  team,
  label,
  onMeldClick,
}: {
  state: GameState
  team: 'nos' | 'eles'
  label: string
  onMeldClick?: (meldId: string) => void
}) {
  const melds = state.melds[team]
  const reds = state.redThrees[team]
  const empty = melds.length === 0 && reds.length === 0
  return (
    <div className="rounded-xl border border-white/5 bg-black/10 p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-bone-200/50">{label}</span>
        {reds.length > 0 && (
          <span className="rounded-full bg-suit-red/80 px-2 py-0.5 text-[9px] font-bold text-white">
            {reds.length} × 3♥ (+{reds.length * 100})
          </span>
        )}
      </div>
      {empty ? (
        <div className="py-2 text-center text-[11px] text-bone-200/30">sem jogos ainda</div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {melds.map((m) => (
            <button
              key={m.id}
              onClick={onMeldClick ? () => onMeldClick(m.id) : undefined}
              className={`flex shrink-0 items-center rounded-lg bg-black/15 p-1 ${onMeldClick ? 'ring-1 ring-brass-400/50 hover:ring-brass-300' : ''}`}
            >
              {m.cards.map((c: Card, i: number) => (
                <div key={c.id} style={{ marginLeft: i ? -26 : 0 }}>
                  <PlayingCard card={c} size="sm" />
                </div>
              ))}
              {isCanastra(m.cards) && (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold ${isCanastraLimpa(m.cards) ? 'bg-brass-400 text-ink' : 'bg-white/20'}`}>
                  {isCanastraLimpa(m.cards) ? '200' : '100'}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function EndOverlay({
  state,
  canAdvance,
  onNext,
  onLeave,
}: {
  state: GameState
  canAdvance: boolean
  onNext: () => void
  onLeave: () => void
}) {
  const over = state.phase === 'matchOver'
  const winnerTxt = state.winner === 'nos' ? 'Nós' : 'Eles'
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 px-6 backdrop-blur-sm">
      <div className="panel w-full max-w-sm rounded-2xl p-6 text-center">
        <h2 className="text-2xl text-gold">{over ? `🏆 Dupla ${winnerTxt} venceu!` : 'Fim da mão'}</h2>
        <div className="my-4 flex justify-center gap-8">
          <div>
            <div className="text-xs uppercase tracking-widest text-brass-300">Nós</div>
            <div className="font-display text-3xl">{state.scores.nos}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-ember-400">Eles</div>
            <div className="font-display text-3xl">{state.scores.eles}</div>
          </div>
        </div>
        {over ? (
          <Button variant="gold" className="w-full" onClick={onLeave}>
            Voltar ao início
          </Button>
        ) : canAdvance ? (
          <Button variant="gold" className="w-full" onClick={onNext}>
            Próxima mão
          </Button>
        ) : (
          <p className="text-sm text-bone-200/60">Aguardando o anfitrião iniciar a próxima mão…</p>
        )}
      </div>
    </div>
  )
}
