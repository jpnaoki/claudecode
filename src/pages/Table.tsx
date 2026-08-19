import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMatch } from '@/store/matchStore'
import { useRoom } from '@/store/roomStore'
import { getIdentity } from '@/lib/identity'
import { Seat, teamOf, GameState } from '@/engine/state'
import { isCanastra, isCanastraLimpa, validateMeld } from '@/engine/sequence'
import { canTakeDiscard } from '@/engine/engine'
import { nextBotAction } from '@/engine/bot'
import { Card, isWild, isRedThree } from '@/lib/types'
import { sfx, unlockAudio, vibrate } from '@/lib/sfx'
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
  const mode = useMatch((s) => s.mode)
  const humanSeat = useMatch((s) => s.humanSeat)
  const bots = useMatch((s) => s.bots)
  const error = useMatch((s) => s.error)
  const act = useMatch((s) => s.act)
  const leaveMatch = useMatch((s) => s.leave)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Decide online x offline + reconexão (volta pela sala salva)
  useEffect(() => {
    const m = useMatch.getState()
    // já tem uma partida offline (bots/hotseat) rolando → não mexe
    if (m.state && m.mode !== 'online') return

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
    if (code && me.name) {
      if (m.code !== code || !m.state) m.join(code, me.id)
    } else if (!m.state) {
      // offline: retoma o jogo salvo; senão começa contra BOTS.
      // (nunca cair no "passa e joga" sem querer — dava a impressão de bot que não joga)
      if (!m.resumeOffline()) m.startBots()
    }
  }, [])

  const viewSeat: Seat | null =
    mode === 'bots' ? humanSeat : local && state ? state.turn : mySeat
  const isMyTurn =
    !!state &&
    (mode === 'bots'
      ? state.turn === humanSeat
      : mode === 'hotseat'
        ? true
        : mySeat != null && state.turn === mySeat)

  // limpa seleção ao trocar de quem joga
  useEffect(() => setSelected(new Set()), [state?.turn, viewSeat])

  // destrava o áudio no primeiro toque (iOS)
  useEffect(() => {
    const h = () => unlockAudio()
    window.addEventListener('pointerdown', h, { once: true })
    return () => window.removeEventListener('pointerdown', h)
  }, [])

  // aviso suave: cue ao começar a vez + nudge após 60s sem jogar
  const [nudge, setNudge] = useState(false)
  useEffect(() => {
    setNudge(false)
    if (!state || !isMyTurn || (state.phase !== 'draw' && state.phase !== 'play')) return
    sfx.play()
    const t = setTimeout(() => {
      setNudge(true)
      sfx.turn()
      vibrate(60)
    }, 60000)
    return () => clearTimeout(t)
  }, [state?.turn, state?.rev, isMyTurn, state?.phase])

  // som de vitória
  useEffect(() => {
    if (state?.phase === 'matchOver') sfx.win()
  }, [state?.phase])

  // destaca a carta recém-comprada por uns instantes
  const [highlightId, setHighlightId] = useState<string | null>(null)
  useEffect(() => {
    if (!state?.lastDrawn) return
    setHighlightId(state.lastDrawn)
    const t = setTimeout(() => setHighlightId(null), 2600)
    return () => clearTimeout(t)
  }, [state?.lastDrawn])

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

  // auto-organiza a mão a cada nova mão distribuída (uma vez por mão)
  useEffect(() => {
    if (viewSeat == null || !state) return
    setOrder(sortedHandIds(state.hands[viewSeat]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.handNumber, viewSeat])

  // driver dos bots (modo offline): quando é a vez de um bot, ele joga sozinho
  const botTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (mode !== 'bots' || !state) return
    if (!bots.includes(state.turn)) return
    if (state.phase !== 'draw' && state.phase !== 'play') return
    botTimer.current = setTimeout(() => {
      const m = useMatch.getState()
      const cur = m.state
      if (!cur || !bots.includes(cur.turn)) return
      const revAntes = cur.rev
      const a = nextBotAction(cur, cur.turn)
      if (a) m.act(a)
      // Rede de segurança: se a jogada não passou (estado intacto), descarta pra
      // não congelar a mesa esperando um bot que não consegue jogar.
      const depois = useMatch.getState().state
      if (depois && depois.rev === revAntes && bots.includes(depois.turn)) {
        const mao = depois.hands[depois.turn]
        if (depois.phase === 'draw') m.act({ type: 'draw' })
        else if (mao.length) m.act({ type: 'discard', cardId: mao[mao.length - 1].id })
      }
    }, 750)
    return () => {
      if (botTimer.current) clearTimeout(botTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.rev, mode])

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

  const selectedCards = ids.map((id) => byId.get(id)).filter(Boolean) as Card[]
  const selectedAllRed3 =
    ids.length > 0 && ids.every((id) => { const card = byId.get(id); return !!card && isRedThree(card) })
  const canBaixar = isMyTurn && state.phase === 'play' && (ids.length >= 3 || selectedAllRed3)
  const podePegarLixo =
    isMyTurn && state.phase === 'draw' && !state.hasDrawn && canTakeDiscard(state, state.turn)
  const canDrawStock = isMyTurn && state.phase === 'draw' && !state.hasDrawn

  const doBaixar = () => {
    sfx.play()
    if (selectedAllRed3) act({ type: 'layRedThrees', cardIds: ids })
    else act({ type: 'meld', cardIds: ids })
    setSelected(new Set())
  }
  const doDiscard = () => {
    if (ids.length !== 1) return
    sfx.play()
    act({ type: 'discard', cardId: ids[0] })
    setSelected(new Set())
  }
  const addTo = (meldId: string) => {
    if (ids.length === 0) return
    sfx.play()
    act({ type: 'addToMeld', meldId, cardIds: ids })
    setSelected(new Set())
  }

  return (
    /* Mesa de tela ÚNICA: trava na altura da viewport (dvh cobre a barra do
       navegador no celular). Só a área de jogos rola — a página nunca. */
    <div
      className="mx-auto flex h-[100dvh] max-h-[100dvh] w-full max-w-md flex-col overflow-hidden px-3"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <SocialLayer />

      {/* topo */}
      <header className="flex shrink-0 items-center justify-between py-1.5">
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

      <TurnBanner state={state} isMyTurn={isMyTurn} local={local} nudge={nudge} />

      {/* parceiro (topo) */}
      <div className="flex shrink-0 justify-center py-0.5">
        <SeatChip state={state} seat={top} />
      </div>

      {/* meio: oponentes + centro */}
      <div className="my-1 grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-1">
        <SeatChip state={state} seat={left} vertical />

        <div
          className="flex items-center justify-center gap-3 rounded-[1.4rem] border border-brass-500/25 py-2"
          style={{
            background: 'radial-gradient(120% 140% at 50% 0%, rgba(20,120,78,.45), rgba(0,0,0,.28))',
            boxShadow: 'inset 0 2px 10px rgba(0,0,0,.45)',
          }}
        >
          <Pile
            label={
              state.stock.length === 0 && state.mortos.length > 0
                ? 'vazio → vira morto'
                : `monte ${state.stock.length}`
            }
            warn={state.stock.length <= 5 && state.mortos.length === 0}
          >
            <button
              type="button"
              disabled={!canDrawStock}
              onClick={() => { sfx.play(); act({ type: 'draw' }) }}
              aria-label="Comprar do monte"
              className={`rounded-xl transition-transform ${
                canDrawStock ? 'animate-pulse ring-2 ring-brass-300 hover:-translate-y-1 active:scale-95' : 'cursor-default'
              }`}
            >
              <PlayingCard faceDown size="md" />
            </button>
          </Pile>
          <Pile label={state.discardLocked ? '🔒 lixo' : `lixo ${state.discard.length}`}>
            <button
              type="button"
              disabled={!podePegarLixo}
              onClick={() => { sfx.play(); act({ type: 'takeDiscard', meldWith: ids }); setSelected(new Set()) }}
              aria-label="Pegar o lixo"
              className={`rounded-xl transition-transform ${
                podePegarLixo ? 'ring-2 ring-emerald-400 hover:-translate-y-1 active:scale-95' : 'cursor-default'
              }`}
            >
              {topDiscard ? (
                <PlayingCard card={topDiscard} size="md" />
              ) : (
                <div className="grid h-24 w-16 place-items-center rounded-xl border border-dashed border-white/15 text-[10px] text-bone-200/30">
                  vazio
                </div>
              )}
            </button>
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
      {ids.length > 0 && state.phase === 'play' && (
        <div className="mb-1 shrink-0 rounded-lg bg-brass-500/10 py-1 text-center text-[10px] text-brass-200">
          Toque num jogo abaixo pra <b>encaixar</b> · ou <b>Baixar</b> pra nova sequência
        </div>
      )}
      {/* única região que rola (quando há muitos jogos) — o resto fica fixo */}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        <TeamMelds
          state={state}
          team={myTeam}
          label="Nossos jogos"
          selectedCards={selectedCards}
          onMeldClick={ids.length ? addTo : undefined}
        />
        <TeamMelds state={state} team={myTeam === 'nos' ? 'eles' : 'nos'} label="Jogos deles" />
      </div>

      {/* minha mão */}
      {viewSeat != null && (
        <div className="mt-1 shrink-0">
          <div className="mb-0.5 flex items-center justify-between px-1">
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
          <Hand cards={hand} selectedIds={selected} highlightId={highlightId} onToggle={toggle} onReorder={setOrder} />
        </div>
      )}

      {state.phase === 'draw' && podePegarLixo && (
        <div className="mt-0.5 shrink-0 text-center text-[10px] text-brass-200">
          Pegar o lixo: selecione as cartas que fazem jogo com o topo (ou deixe vazio se ele encaixa num jogo seu)
        </div>
      )}
      {/* ações */}
      <div className="mt-1.5 flex shrink-0 gap-2">
        {state.phase === 'draw' ? (
          <>
            <Button variant="gold" className="flex-1 !px-2" disabled={!isMyTurn || state.hasDrawn} onClick={() => { sfx.play(); act({ type: 'draw' }) }}>
              Comprar
            </Button>
            <Button
              variant="primary"
              className="flex-1 !px-2"
              disabled={!podePegarLixo}
              onClick={() => { sfx.play(); act({ type: 'takeDiscard', meldWith: ids }); setSelected(new Set()) }}
            >
              Pegar lixo
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" className="flex-1 !px-2" disabled={!canBaixar} onClick={doBaixar}>
              {selectedAllRed3 ? 'Baixar 3♥ (+1)' : 'Baixar'}
            </Button>
            <Button variant="gold" className="flex-1 !px-2" disabled={!isMyTurn || selected.size !== 1} onClick={doDiscard}>
              Descartar
            </Button>
          </>
        )}
      </div>

      {/* reações */}
      <div className="mt-1 flex shrink-0 justify-center">
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
        <EndOverlay
          state={state}
          myTeam={myTeam}
          canAdvance={local || mySeat === 0}
          onNext={() => act({ type: 'nextHand' })}
          onLeave={leave}
        />
      )}
    </div>
  )
}

/** Mão do jogador: tocar pra selecionar, segurar e arrastar pra reordenar (toque ou mouse). */
function Hand({
  cards,
  selectedIds,
  highlightId,
  onToggle,
  onReorder,
}: {
  cards: Card[]
  selectedIds: Set<string>
  highlightId: string | null
  onToggle: (id: string) => void
  onReorder: (ids: string[]) => void
}) {
  const dragId = useRef<string | null>(null)
  const moved = useRef(false)
  const start = useRef({ x: 0, y: 0 })
  const [activeDrag, setActiveDrag] = useState<string | null>(null)

  /**
   * A mão precisa caber na tela SEMPRE — inclusive com 22 cartas depois do morto.
   * Até 13 cartas: uma fileira. Acima disso: duas, senão a sobreposição fica tão
   * grande que não dá pra ler nem tocar. A sobreposição é medida da largura real.
   */
  const rowsCount = cards.length > 13 ? 2 : 1
  const perRow = Math.ceil(cards.length / rowsCount) || 1
  const rows: Card[][] = []
  for (let i = 0; i < cards.length; i += perRow) rows.push(cards.slice(i, i + perRow))

  const wrapRef = useRef<HTMLDivElement>(null)
  const [overlap, setOverlap] = useState(14)
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const CARD = 64 // largura da carta md (w-16)
    const compute = () => {
      const w = el.clientWidth
      if (perRow <= 1 || w === 0) return setOverlap(0)
      const advance = (w - CARD) / (perRow - 1) // quanto cada carta avança
      setOverlap(Math.min(46, Math.max(4, Math.round(CARD - advance))))
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [perRow])

  const down = (e: React.PointerEvent, id: string) => {
    dragId.current = id
    moved.current = false
    start.current = { x: e.clientX, y: e.clientY }
  }

  const move = (e: React.PointerEvent) => {
    if (!dragId.current) return
    if (!moved.current) {
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) < 8) return
      moved.current = true
      setActiveDrag(dragId.current)
    }
    const over = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.closest('[data-card-id]')
    const overId = over?.getAttribute('data-card-id')
    if (!overId || overId === dragId.current) return
    const ids = cards.map((c) => c.id)
    const from = ids.indexOf(dragId.current)
    const to = ids.indexOf(overId)
    if (from < 0 || to < 0) return
    ids.splice(to, 0, ids.splice(from, 1)[0])
    onReorder(ids)
  }

  const up = (id: string) => {
    if (!moved.current) onToggle(id) // foi um toque → seleciona
    dragId.current = null
    moved.current = false
    setActiveDrag(null)
  }

  return (
    <div ref={wrapRef} className="pt-1.5" onPointerMove={move}>
      {rows.map((row, r) => (
        <div key={r} className={`flex justify-center ${r ? 'mt-1' : ''}`}>
          {row.map((c, i) => (
            <div
              key={c.id}
              data-card-id={c.id}
              onPointerDown={(e) => down(e, c.id)}
              onPointerUp={() => up(c.id)}
              onPointerCancel={() => up(c.id)}
              style={{ marginLeft: i ? -overlap : 0, touchAction: 'none' }}
              className={`cursor-grab transition-transform ${
                activeDrag === c.id ? 'z-20 -translate-y-3 scale-105 opacity-80' : ''
              } ${highlightId === c.id ? 'animate-deal z-10' : ''}`}
            >
              <div
                className={
                  highlightId === c.id
                    ? 'rounded-xl shadow-glow ring-2 ring-brass-300 ring-offset-1 ring-offset-felt-800'
                    : ''
                }
              >
                <PlayingCard card={c} size="md" selected={selectedIds.has(c.id)} />
              </div>
            </div>
          ))}
        </div>
      ))}
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

function TurnBanner({
  state,
  isMyTurn,
  local,
  nudge,
}: {
  state: GameState
  isMyTurn: boolean
  local: boolean
  nudge: boolean
}) {
  const name = state.players[state.turn]?.name ?? `Assento ${state.turn}`
  const phaseTxt = state.phase === 'draw' ? 'comprar' : 'jogar/descartar'
  return (
    <div
      className={`flex items-center justify-center gap-2 rounded-full py-1 text-xs transition-colors ${
        nudge
          ? 'animate-pulse bg-ember-500/25 font-semibold text-ember-200 ring-1 ring-ember-500/50'
          : isMyTurn
            ? 'bg-brass-500/15 text-brass-200'
            : 'text-bone-200/50'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${isMyTurn ? 'animate-pulse bg-ember-500' : 'bg-white/20'}`} />
      {local
        ? `Vez de ${name} · ${phaseTxt}`
        : isMyTurn
          ? `${nudge ? '⏰ ' : ''}Sua vez · ${phaseTxt}`
          : `Vez de ${name}`}
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

function Pile({
  label,
  warn,
  children,
}: {
  label: string
  warn?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      {children}
      <span
        className={`text-[10px] uppercase tracking-wider ${
          warn ? 'font-bold text-ember-400' : 'text-bone-200/50'
        }`}
      >
        {label}
      </span>
    </div>
  )
}

function TeamMelds({
  state,
  team,
  label,
  selectedCards = [],
  onMeldClick,
}: {
  state: GameState
  team: 'nos' | 'eles'
  label: string
  selectedCards?: Card[]
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
          {melds.map((m) => {
            const fits =
              !!onMeldClick && selectedCards.length > 0 && validateMeld([...m.cards, ...selectedCards]).ok
            return (
              <button
                key={m.id}
                onClick={onMeldClick ? () => onMeldClick(m.id) : undefined}
                className={`flex shrink-0 items-center rounded-lg p-1 ${
                  fits
                    ? 'animate-pulse bg-emerald-500/20 ring-2 ring-emerald-400'
                    : onMeldClick
                      ? 'bg-black/15 ring-1 ring-brass-400/40'
                      : 'bg-black/15'
                }`}
              >
                {fits && <span className="px-1 text-[9px] font-bold text-emerald-300">✓ encaixa</span>}
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
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Fim de mão explicado: POR QUE acabou e de onde veio cada ponto. */
function EndOverlay({
  state,
  myTeam,
  canAdvance,
  onNext,
  onLeave,
}: {
  state: GameState
  myTeam: 'nos' | 'eles'
  canAdvance: boolean
  onNext: () => void
  onLeave: () => void
}) {
  const over = state.phase === 'matchOver'
  const winnerTxt = state.winner === 'nos' ? 'Nós' : 'Eles'
  const lh = state.lastHand
  const outro = myTeam === 'nos' ? 'eles' : 'nos'
  const nome = (t: 'nos' | 'eles') => (t === 'nos' ? 'Nós' : 'Eles')

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="panel flex max-h-full w-full max-w-sm flex-col rounded-2xl p-5">
        <h2 className="shrink-0 text-center text-2xl text-gold">
          {over ? `🏆 Dupla ${winnerTxt} venceu!` : 'Fim da mão'}
        </h2>

        {/* POR QUE a mão acabou — era o que pegava todo mundo de surpresa */}
        {lh && (
          <p className="mt-1 shrink-0 text-center text-xs text-bone-200/70">
            {lh.reason === 'bateu'
              ? `${lh.batedorNome ?? 'Alguém'} bateu — dupla ${nome(lh.batedor ?? 'nos')} encerrou a mão.`
              : 'O monte de compras acabou — por isso a mão terminou.'}
          </p>
        )}

        {/* placar acumulado */}
        <div className="my-3 flex shrink-0 justify-center gap-8">
          <div>
            <div className="text-xs uppercase tracking-widest text-brass-300">Nós</div>
            <div className="font-display text-3xl">{state.scores.nos}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-ember-400">Eles</div>
            <div className="font-display text-3xl">{state.scores.eles}</div>
          </div>
        </div>

        {/* extrato desta mão */}
        {lh && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mb-1 text-center text-[10px] uppercase tracking-widest text-bone-200/40">
              nesta mão
            </div>
            {([myTeam, outro] as const).map((t) => (
              <div key={t} className="mb-2 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className={`text-xs font-bold uppercase tracking-widest ${t === 'nos' ? 'text-brass-300' : 'text-ember-400'}`}>
                    {nome(t)} {t === myTeam && <span className="text-bone-200/40">(você)</span>}
                  </span>
                  <span className={`font-display text-lg ${lh.scores[t].total >= 0 ? 'text-bone-50' : 'text-ember-400'}`}>
                    {lh.scores[t].total >= 0 ? '+' : ''}
                    {lh.scores[t].total}
                  </span>
                </div>
                {lh.scores[t].lines.length === 0 ? (
                  <div className="text-[11px] text-bone-200/40">sem pontos nesta mão</div>
                ) : (
                  <ul className="space-y-0.5">
                    {lh.scores[t].lines.map((l, i) => (
                      <li key={i} className="flex items-baseline justify-between text-[11px]">
                        <span className="text-bone-200/70">
                          {l.label}
                          {l.detail && <span className="text-bone-200/35"> · {l.detail}</span>}
                        </span>
                        <span className={l.value >= 0 ? 'text-emerald-300/90' : 'text-ember-400'}>
                          {l.value >= 0 ? '+' : ''}
                          {l.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 shrink-0">
          {over ? (
            <Button variant="gold" className="w-full" onClick={onLeave}>
              Voltar ao início
            </Button>
          ) : canAdvance ? (
            <Button variant="gold" className="w-full" onClick={onNext}>
              Próxima mão · alvo {state.target}
            </Button>
          ) : (
            <p className="text-center text-sm text-bone-200/60">
              Aguardando o anfitrião iniciar a próxima mão…
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
