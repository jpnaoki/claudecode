import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

/**
 * Cinzeiro interativo — peça social do app.
 * Clica pra "acender": sai uma baforada de fumaça e a brasa fica acesa por um tempo.
 * (Aqui é local/demonstração; na Fase 3 o estado é sincronizado via Supabase Realtime
 *  pra todos da mesa verem em tempo real.)
 */
export default function Ashtray({ name = 'você' }: { name?: string }) {
  const [puffs, setPuffs] = useState<number[]>([])
  const [lit, setLit] = useState(false)

  const light = () => {
    setLit(true)
    const id = Date.now()
    setPuffs((p) => [...p, id])
    setTimeout(() => setPuffs((p) => p.filter((x) => x !== id)), 3000)
    setTimeout(() => setLit(false), 6000)
  }

  return (
    <button
      onClick={light}
      title="Acender um cigarro"
      className="group relative grid h-28 w-28 place-items-center rounded-full panel"
      aria-label="Cinzeiro interativo"
    >
      {/* fumaça */}
      <AnimatePresence>
        {puffs.map((id) => (
          <motion.span
            key={id}
            initial={{ opacity: 0, y: 0, scale: 0.6 }}
            animate={{ opacity: [0, 0.5, 0], y: -70, scale: 1.9 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3, ease: 'easeOut' }}
            className="pointer-events-none absolute bottom-16 left-[60%] h-10 w-6 rounded-full bg-white/40 blur-md"
          />
        ))}
      </AnimatePresence>

      {/* cigarro: filtro (boca) → corpo branco (fumo) → brasa */}
      <div className="relative flex items-center">
        {/* filtro */}
        <div className="h-2.5 w-4 rounded-l-sm bg-[#E8B04B]" />
        {/* corpo branco */}
        <div className="h-2.5 w-16 bg-bone-100 shadow-inner" />
        {/* brasa (acende o lado branco) */}
        <motion.div
          animate={lit ? { opacity: [0.6, 1, 0.6], scale: [1, 1.25, 1] } : { opacity: 0.25 }}
          transition={{ duration: 1.2, repeat: lit ? Infinity : 0 }}
          className={`h-2.5 w-2.5 rounded-r-full ${lit ? 'bg-ember-500 shadow-glow' : 'bg-ember-600/40'}`}
        />
      </div>

      <span className="absolute -bottom-6 text-[11px] uppercase tracking-widest text-brass-400/80">
        {lit ? `${name} acendeu` : 'cinzeiro'}
      </span>
    </button>
  )
}
