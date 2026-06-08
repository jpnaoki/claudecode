import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '@/components/ui/Button'
import Ashtray from '@/components/Ashtray'
import PlayingCard from '@/components/PlayingCard'
import { Card } from '@/lib/types'
import { generateRoomCode, setName as persistName } from '@/lib/identity'

const FAN: Card[] = [
  { id: 'a', suit: 'espadas', rank: 'A' },
  { id: 'b', suit: 'copas', rank: 'K' },
  { id: 'c', suit: 'ouros', rank: '2' },
  { id: 'd', suit: 'paus', rank: '7' },
]

export default function Home() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  const createRoom = () => {
    persistName(name)
    navigate(`/sala/${generateRoomCode()}`)
  }
  const joinRoom = () => {
    persistName(name)
    navigate(`/sala/${code.toUpperCase()}`)
  }

  return (
    <div className="min-h-full">
      {/* topo */}
      <header className="mx-auto flex max-w-md items-center justify-between px-5 pt-6">
        <span className="font-display text-lg text-gold">Tranca</span>
        <Link
          to="/estilo"
          className="text-xs uppercase tracking-widest text-brass-400/70 hover:text-brass-300"
        >
          guia de estilo
        </Link>
      </header>

      <main className="mx-auto flex max-w-md flex-col items-center px-5 pb-16 pt-6">
        {/* leque de cartas */}
        <div className="mb-2 flex justify-center">
          {FAN.map((c, i) => (
            <div
              key={c.id}
              className="animate-deal"
              style={{
                transform: `rotate(${(i - 1.5) * 9}deg) translateY(${Math.abs(i - 1.5) * 6}px)`,
                marginLeft: i ? -22 : 0,
                animationDelay: `${i * 90}ms`,
              }}
            >
              <PlayingCard card={c} size="md" />
            </div>
          ))}
        </div>

        <h1 className="mt-6 text-center text-4xl leading-tight">
          A mesa de <span className="text-gold">tranca</span>
          <br /> que cabe no bolso
        </h1>
        <p className="mt-3 max-w-xs text-center text-sm text-bone-200/70">
          Duas duplas, dois baralhos, do jeito certo. Reúna a turma mesmo de longe —
          com direito a cinzeiro na mesa. 🚬
        </p>

        {/* painel de entrada */}
        <div className="panel mt-8 w-full rounded-2xl p-5">
          <label className="mb-1 block text-xs uppercase tracking-widest text-brass-400/70">
            Seu nome
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Como aparece na mesa"
            className="mb-4 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-bone-200/30 focus:border-brass-500/50"
          />

          <Button
            variant="gold"
            className="w-full"
            disabled={!name.trim()}
            onClick={createRoom}
          >
            Criar mesa
          </Button>

          <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-widest text-bone-200/40">
            <div className="hairline-brass flex-1 opacity-40" />
            ou entrar
            <div className="hairline-brass flex-1 opacity-40" />
          </div>

          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CÓDIGO"
              maxLength={6}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center text-sm tracking-[0.3em] outline-none placeholder:tracking-widest placeholder:text-bone-200/30 focus:border-brass-500/50"
            />
            <Button disabled={!name.trim() || code.length < 4} onClick={joinRoom}>
              Entrar
            </Button>
          </div>
        </div>

        {/* cinzeiro de boas-vindas */}
        <div className="mt-12 flex flex-col items-center gap-3">
          <Ashtray name={name.trim() || 'você'} />
          <p className="mt-3 max-w-[14rem] text-center text-[11px] text-bone-200/40">
            Clica no cigarro pra acender. Na mesa, todo mundo vê a fumaça em tempo real.
          </p>
        </div>
      </main>
    </div>
  )
}
