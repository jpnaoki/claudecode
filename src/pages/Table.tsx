import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useGame } from '@/store/gameStore'
import { useRoom } from '@/store/roomStore'
import PlayingCard from '@/components/PlayingCard'
import Button from '@/components/ui/Button'
import Seat from '@/components/table/Seat'
import MeldArea from '@/components/table/MeldArea'
import EmoteBar from '@/components/social/EmoteBar'
import SocialLayer from '@/components/social/SocialLayer'

function Pile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {children}
      <span className="text-[10px] uppercase tracking-wider text-bone-200/50">{label}</span>
    </div>
  )
}

export default function Table() {
  const s = useGame()
  const navigate = useNavigate()
  const disconnect = useRoom((r) => r.disconnect)
  const myTurn = s.turnSeat === 0

  const leave = () => {
    disconnect()
    navigate('/')
  }
  const partner = s.players[2]
  const left = s.players[1]
  const right = s.players[3]
  const topDiscard = s.discard[s.discard.length - 1]

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-3 pb-3">
      <SocialLayer />
      {/* Top bar: placar */}
      <header className="flex items-center justify-between py-2">
        <button onClick={leave} className="text-xs uppercase tracking-widest text-brass-400/70">
          ← sair
        </button>
        <div className="panel flex items-center gap-4 rounded-full px-4 py-1.5">
          <Score label="Nós" value={s.teams.nos.score} accent />
          <div className="h-5 w-px bg-white/10" />
          <Score label="Eles" value={s.teams.eles.score} />
        </div>
        <button
          onClick={s.newGame}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-widest text-brass-300 transition-colors hover:bg-white/10"
        >
          novo jogo
        </button>
      </header>

      {/* Parceiro (topo) */}
      <div className="flex justify-center py-1">
        <Seat player={partner} count={s.handCounts[2]} active={s.turnSeat === 2} />
      </div>

      {/* Linha do meio: oponentes + montes centrais */}
      <div className="my-2 grid grid-cols-[auto_1fr_auto] items-center gap-1">
        <Seat player={left} count={s.handCounts[1]} active={s.turnSeat === 1} orientation="vertical" />

        <div
          className="flex items-center justify-center gap-3 rounded-[1.4rem] border border-brass-500/25 py-4"
          style={{
            background: 'radial-gradient(120% 140% at 50% 0%, rgba(20,120,78,.45), rgba(0,0,0,.28))',
            boxShadow: 'inset 0 2px 10px rgba(0,0,0,.45), inset 0 0 0 1px rgba(201,162,75,.08)',
          }}
        >
          <Pile label={`monte ${s.stockCount}`}>
            <button onClick={s.drawFromStock} disabled={!myTurn} className="disabled:opacity-50">
              <PlayingCard faceDown size="md" />
            </button>
          </Pile>
          <Pile label={`lixo ${s.discard.length}`}>
            {topDiscard ? (
              <button onClick={s.takeDiscard} disabled={!myTurn}>
                <PlayingCard card={topDiscard} size="md" />
              </button>
            ) : (
              <div className="grid h-24 w-16 place-items-center rounded-xl border border-dashed border-white/15 text-[10px] text-bone-200/30">
                vazio
              </div>
            )}
          </Pile>
          <Pile label="mortos">
            <div className="relative">
              <PlayingCard faceDown size="md" className="!w-12" />
              <div className="absolute -right-2 -top-1">
                <PlayingCard faceDown size="md" className="!w-12" />
              </div>
            </div>
          </Pile>
        </div>

        <Seat player={right} count={s.handCounts[3]} active={s.turnSeat === 3} orientation="vertical" />
      </div>

      {/* Jogos das duplas */}
      <div className="space-y-2">
        <MeldArea label="Nossos jogos" melds={s.teams.nos.melds} redThrees={s.teams.nos.redThrees} />
        <MeldArea label="Jogos deles" melds={s.teams.eles.melds} redThrees={s.teams.eles.redThrees} />
      </div>

      <div className="flex-1" />

      {/* Minha mão */}
      <div className="mt-2">
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="text-[10px] uppercase tracking-widest text-bone-200/50">
            Sua mão · {s.myHand.length}
          </span>
          <span className="text-[10px] text-brass-300">
            {s.selected.size > 0 ? `${s.selected.size} selecionada(s)` : myTurn ? 'sua vez' : 'aguarde'}
          </span>
        </div>
        <div key={s.round} className="flex overflow-x-auto pb-2 pt-3">
          {s.myHand.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ y: -120, opacity: 0, rotate: -8 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              transition={{ delay: i * 0.04, type: 'spring', stiffness: 320, damping: 26 }}
              style={{ marginLeft: i ? -20 : 0 }}
            >
              <PlayingCard
                card={c}
                size="md"
                selected={s.selected.has(c.id)}
                onClick={() => s.toggleSelect(c.id)}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Barra de ações */}
      <div className="mt-1 flex gap-2">
        <Button variant="ghost" className="flex-1 !px-2" onClick={s.meldSelected} disabled={s.selected.size < 3}>
          Baixar
        </Button>
        <Button variant="gold" className="flex-1 !px-2" onClick={s.discardSelected} disabled={s.selected.size !== 1 || !myTurn}>
          Descartar
        </Button>
        <Button variant="primary" className="flex-1 !px-2" disabled>
          Bater
        </Button>
      </div>

      {/* Reações ao vivo (cinzeiro + emotes compartilhados) */}
      <div className="mt-2 flex justify-center">
        <EmoteBar compact />
      </div>
    </div>
  )
}

function Score({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="text-center">
      <div className={`text-[9px] uppercase tracking-widest ${accent ? 'text-brass-300' : 'text-ember-400'}`}>
        {label}
      </div>
      <div className="font-display text-lg leading-none">{value}</div>
    </div>
  )
}
