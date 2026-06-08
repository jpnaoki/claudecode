import { Link } from 'react-router-dom'
import PlayingCard from '@/components/PlayingCard'
import Button from '@/components/ui/Button'
import Ashtray from '@/components/Ashtray'
import { BONUS } from '@/lib/scoring'
import { Card, RANKS, Suit } from '@/lib/types'

const SWATCHES = [
  ['Feltro 900', '#072C1E'], ['Feltro 800', '#0A3D2A'], ['Feltro 600', '#127A4E'],
  ['Latão 500', '#C9A24B'], ['Latão 300', '#E8D29A'], ['Creme 100', '#F7F1E3'],
  ['Vermelho', '#B3261E'], ['Preto', '#1C1C1C'], ['Brasa', '#F2682C'],
]

const sample = (suit: Suit): Card[] =>
  RANKS.map((rank) => ({ id: `${rank}-${suit}`, suit, rank }))

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="mb-1 text-xl text-gold">{title}</h2>
      <div className="hairline-brass mb-5 opacity-50" />
      {children}
    </section>
  )
}

export default function StyleGuide() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl">Guia de estilo</h1>
          <p className="text-sm text-bone-200/60">Tranca Online — clássico + moderno premium</p>
        </div>
        <Link to="/" className="text-xs uppercase tracking-widest text-brass-400/70 hover:text-brass-300">
          ← início
        </Link>
      </header>

      <Section title="Tipografia">
        <p className="font-display text-4xl">Fraunces — títulos com alma clássica</p>
        <p className="mt-2 font-sans text-base text-bone-200/80">
          Manrope — texto de interface, limpo e moderno. 0123456789
        </p>
      </Section>

      <Section title="Paleta">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {SWATCHES.map(([name, hex]) => (
            <div key={name} className="overflow-hidden rounded-xl panel">
              <div className="h-16" style={{ background: hex }} />
              <div className="px-2 py-1.5">
                <div className="text-xs font-semibold">{name}</div>
                <div className="text-[10px] text-bone-200/50">{hex}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Botões">
        <div className="flex flex-wrap gap-3">
          <Button variant="gold">Criar mesa</Button>
          <Button variant="primary">Comprar carta</Button>
          <Button variant="ghost">Passar</Button>
          <Button variant="gold" disabled>Desabilitado</Button>
        </div>
      </Section>

      <Section title="Cartas">
        <div className="mb-4 flex items-end gap-4">
          <PlayingCard card={{ id: '1', suit: 'copas', rank: 'A' }} size="lg" />
          <PlayingCard card={{ id: '2', suit: 'espadas', rank: 'K' }} size="md" selected />
          <PlayingCard card={{ id: '3', suit: 'ouros', rank: '2' }} size="md" />
          <PlayingCard card={{ id: '4', suit: 'paus', rank: '3' }} size="sm" />
          <PlayingCard faceDown size="md" />
        </div>
        <p className="mb-2 text-xs uppercase tracking-widest text-brass-400/70">
          Sequência de copas (mesmo naipe)
        </p>
        <div className="flex flex-wrap gap-1">
          {sample('copas').map((c) => (
            <PlayingCard key={c.id} card={c} size="sm" />
          ))}
        </div>
      </Section>

      <Section title="Cinzeiro interativo">
        <div className="flex items-center gap-6">
          <Ashtray />
          <p className="max-w-xs text-sm text-bone-200/60">
            Elemento de presença social. Sincronizado em tempo real na Fase 3 — quando
            alguém acende, todos da mesa veem a fumaça subir.
          </p>
        </div>
      </Section>

      <Section title="Regras (referência rápida)">
        <div className="panel grid grid-cols-2 gap-x-6 gap-y-2 rounded-2xl p-5 text-sm sm:grid-cols-3">
          <Rule label="Toda carta">10 pts</Rule>
          <Rule label="Canastra limpa">{BONUS.CANASTRA_LIMPA}</Rule>
          <Rule label="Canastra suja">{BONUS.CANASTRA_SUJA}</Rule>
          <Rule label="Bater">+{BONUS.BATER}</Rule>
          <Rule label="3 vermelho">+{BONUS.TRES_VERMELHO}</Rule>
          <Rule label="3 preto na mão">{BONUS.TRES_PRETO_NA_MAO}</Rule>
          <Rule label="Morto não pego">{BONUS.MORTO_NAO_PEGO}</Rule>
          <Rule label="Baralho">104 cartas</Rule>
          <Rule label="Coringa">os 2</Rule>
        </div>
      </Section>
    </div>
  )
}

function Rule({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-white/5 pb-1">
      <span className="text-bone-200/60">{label}</span>
      <span className="font-semibold text-brass-300">{children}</span>
    </div>
  )
}
