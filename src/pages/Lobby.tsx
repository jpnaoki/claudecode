import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '@/components/ui/Button'
import EmoteBar from '@/components/social/EmoteBar'
import SocialLayer from '@/components/social/SocialLayer'
import { getIdentity, setName as persistName } from '@/lib/identity'
import { useRoom, teamOfSeat, RoomPlayer } from '@/store/roomStore'
import { useMatch } from '@/store/matchStore'
import { Seat, SeatPlayer } from '@/engine/state'
import { SETUP_SQL, sqlEditorUrl } from '@/lib/setupSql'

const SEATS = [0, 1, 2, 3]
const TEAM_LABEL = { nos: 'Nós', eles: 'Eles' } as const

export default function Lobby() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const [me, setMe] = useState(getIdentity())
  const [nameDraft, setNameDraft] = useState(me.name)
  const [copied, setCopied] = useState(false)

  const players = useRoom((s) => s.players)
  const status = useRoom((s) => s.status)
  const lastStatus = useRoom((s) => s.lastStatus)
  const mySeat = useRoom((s) => s.mySeat)
  const connect = useRoom((s) => s.connect)
  const disconnect = useRoom((s) => s.disconnect)
  const setOnStart = useRoom((s) => s.setOnStart)
  const chooseSeat = useRoom((s) => s.chooseSeat)
  const retry = useRoom((s) => s.retry)
  const hostMatch = useMatch((s) => s.host)
  const startBots = useMatch((s) => s.startBots)

  // conecta à sala assim que houver nome
  useEffect(() => {
    if (!me.name) return
    connect(code, me)
    setOnStart(() => navigate('/mesa'))
  }, [code, me, connect, setOnStart, navigate])

  const bySeat = useMemo(() => {
    const map: Record<number, RoomPlayer> = {}
    for (const p of players) if (p.seat != null) map[p.seat] = p
    return map
  }, [players])

  const spectators = players.filter((p) => p.seat == null)
  const allSeated = SEATS.every((s) => bySeat[s])

  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/sala/${code}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* ignore */
    }
  }

  const leave = () => {
    disconnect()
    navigate('/')
  }

  const startGame = async () => {
    const players: Record<Seat, SeatPlayer | null> = { 0: null, 1: null, 2: null, 3: null }
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const p = bySeat[seat]
      if (p) players[seat] = { id: p.id, name: p.name }
    }
    await hostMatch(code, players, me.id) // distribui e grava no Supabase
    navigate('/mesa') // os demais vão sozinhos quando o polling detectar a partida
  }

  // Sem nome ainda → pede antes de entrar na sala
  if (!me.name) {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center px-5">
        <div className="panel w-full rounded-2xl p-6">
          <h1 className="mb-1 text-2xl">Como você aparece na mesa?</h1>
          <p className="mb-4 text-sm text-bone-200/60">Sala {code}</p>
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="Seu nome"
            className="mb-4 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-brass-500/50"
          />
          <Button
            variant="gold"
            className="w-full"
            disabled={!nameDraft.trim()}
            onClick={() => setMe(persistName(nameDraft))}
          >
            Entrar na sala
          </Button>
        </div>
      </div>
    )
  }

  // Backend sem as tabelas → guia o setup (1 vez) em vez de fingir "ao vivo"
  if (status === 'setup-needed' || status === 'no-backend') {
    return (
      <SetupNeeded
        diag={lastStatus}
        onRetry={retry}
        onLeave={leave}
        onPlayBots={() => {
          startBots()
          navigate('/mesa')
        }}
      />
    )
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-5 pb-8">
      <SocialLayer />
      <header className="flex items-center justify-between py-4">
        <button onClick={leave} className="text-xs uppercase tracking-widest text-brass-400/70">
          ← sair
        </button>
        <StatusPill status={status} />
      </header>

      {status === 'error' && lastStatus && (
        <div className="mb-2 rounded-lg border border-ember-500/30 bg-ember-600/10 px-3 py-1.5 text-center text-[10px] text-ember-300">
          erro de conexão: {lastStatus}
        </div>
      )}

      {/* Código da sala */}
      <div className="panel rounded-2xl p-5 text-center">
        <div className="text-xs uppercase tracking-widest text-brass-400/70">Código da sala</div>
        <div className="my-1 font-display text-5xl tracking-[0.2em] text-gold">{code}</div>
        <button
          onClick={share}
          className="mt-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-bone-100 transition-colors hover:bg-white/10"
        >
          {copied ? '✓ link copiado!' : 'copiar link de convite'}
        </button>
      </div>

      {/* Assentos por dupla */}
      <h2 className="mb-2 mt-6 text-lg">Escolha seu lugar</h2>
      <div className="grid grid-cols-2 gap-3">
        {(['nos', 'eles'] as const).map((team) => (
          <div key={team} className="rounded-2xl border border-white/5 bg-black/10 p-2">
            <div
              className={`mb-2 text-center text-xs font-bold uppercase tracking-widest ${
                team === 'nos' ? 'text-brass-300' : 'text-ember-400'
              }`}
            >
              {TEAM_LABEL[team]}
            </div>
            <div className="space-y-2">
              {SEATS.filter((s) => teamOfSeat(s) === team).map((seat) => {
                const p = bySeat[seat]
                const mine = p?.id === me.id
                return (
                  <button
                    key={seat}
                    onClick={() => chooseSeat(mine ? null : seat)}
                    disabled={!!p && !mine}
                    className={`flex w-full items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm transition-all ${
                      p
                        ? mine
                          ? 'border-brass-400 bg-felt-600/60'
                          : 'border-white/10 bg-black/20 opacity-80'
                        : 'border-dashed border-white/20 bg-white/[0.03] hover:bg-white/[0.07]'
                    }`}
                  >
                    {p ? (
                      <>
                        <Avatar name={p.name} />
                        <span className="truncate font-semibold">{p.name}</span>
                        {mine && <span className="ml-auto text-[10px] text-brass-300">você · sair</span>}
                      </>
                    ) : (
                      <span className="text-bone-200/40">+ sentar aqui</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Presentes na sala */}
      <div className="mt-5">
        <div className="mb-2 text-xs uppercase tracking-widest text-bone-200/50">
          Na sala · {players.length}
        </div>
        <div className="flex flex-wrap gap-2">
          {players.map((p) => (
            <span key={p.id} className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {p.name}
              {p.seat != null && (
                <span className="text-[10px] text-brass-300/80">({TEAM_LABEL[teamOfSeat(p.seat)]})</span>
              )}
            </span>
          ))}
          {players.length === 0 && status === 'connected' && (
            <span className="text-xs text-bone-200/40">conectando jogadores…</span>
          )}
        </div>
        {spectators.length > 0 && (
          <p className="mt-2 text-[11px] text-bone-200/40">{spectators.length} aguardando / assistindo</p>
        )}
      </div>

      {/* Reações ao vivo enquanto espera */}
      <div className="mt-5 flex justify-center">
        <EmoteBar />
      </div>

      <div className="flex-1" />

      <Button
        variant="gold"
        className="mt-4 w-full"
        disabled={!allSeated || mySeat == null}
        onClick={startGame}
      >
        {allSeated ? 'Iniciar jogo' : `Aguardando jogadores (${Object.keys(bySeat).length}/4)`}
      </Button>
      {mySeat == null && allSeated && (
        <p className="mt-2 text-center text-[11px] text-bone-200/40">escolha um lugar pra poder iniciar</p>
      )}
    </div>
  )
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-felt-600 text-[10px] font-bold">
      {initials}
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    idle: ['…', 'bg-zinc-400'],
    connecting: ['conectando…', 'bg-amber-400'],
    connected: ['ao vivo', 'bg-emerald-400'],
    'no-backend': ['offline', 'bg-zinc-400'],
    'setup-needed': ['configurar', 'bg-ember-400'],
    error: ['erro de conexão', 'bg-red-400'],
  }
  const [label, dot] = map[status] ?? ['—', 'bg-zinc-400']
  return (
    <span className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[11px] text-bone-200/70">
      <span className={`h-2 w-2 rounded-full ${dot} ${status === 'connected' ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  )
}

/** Tela de configuração: as tabelas do Supabase não existem. Guia o passo único de setup. */
function SetupNeeded({
  diag,
  onRetry,
  onLeave,
  onPlayBots,
}: {
  diag: string | null
  onRetry: () => void
  onLeave: () => void
  onPlayBots: () => void
}) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SETUP_SQL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-5 pb-8">
      <header className="flex items-center justify-between py-4">
        <button onClick={onLeave} className="text-xs uppercase tracking-widest text-brass-400/70">
          ← início
        </button>
        <span className="rounded-full bg-ember-600/20 px-3 py-1 text-[11px] text-ember-300">
          configuração pendente
        </span>
      </header>

      <div className="panel rounded-2xl p-5">
        <h1 className="text-xl text-gold">Falta 1 passo (só uma vez) 🔧</h1>
        <p className="mt-2 text-sm text-bone-200/70">
          O servidor de tempo real ainda não tem as tabelas. Sem elas,{' '}
          <b>cada pessoa fica sozinha na sala</b> — foi o que travou o teste de vocês. Cole o SQL
          abaixo no Supabase e todos passam a se ver.
        </p>

        <ol className="mt-4 space-y-1 text-sm text-bone-100">
          <li>1. Copie o SQL</li>
          <li>2. Abra o SQL Editor do Supabase</li>
          <li>3. Cole e clique em <b>Run</b></li>
          <li>4. Volte e toque em <b>Testar de novo</b></li>
        </ol>

        <pre className="mt-4 max-h-48 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-[10px] leading-relaxed text-bone-200/80">
          {SETUP_SQL}
        </pre>

        <div className="mt-3 flex flex-col gap-2">
          <Button variant="gold" className="w-full" onClick={copy}>
            {copied ? '✓ SQL copiado!' : 'Copiar SQL'}
          </Button>
          <a
            href={sqlEditorUrl()}
            target="_blank"
            rel="noreferrer"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-semibold text-bone-100 transition-colors hover:bg-white/10"
          >
            Abrir SQL Editor ↗
          </a>
          <Button variant="primary" className="w-full" onClick={onRetry}>
            Testar de novo
          </Button>
        </div>

        {diag && (
          <p className="mt-3 break-words text-center text-[10px] text-bone-200/40">
            diagnóstico: {diag}
          </p>
        )}
      </div>

      <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-widest text-bone-200/40">
        <div className="hairline-brass flex-1 opacity-40" />
        enquanto isso
        <div className="hairline-brass flex-1 opacity-40" />
      </div>
      <Button variant="ghost" className="w-full" onClick={onPlayBots}>
        🤖 Jogar offline com bots agora
      </Button>
    </div>
  )
}
