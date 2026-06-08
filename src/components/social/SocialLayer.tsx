import { AnimatePresence, motion } from 'framer-motion'
import { useRoom } from '@/store/roomStore'

// posição horizontal estável por id (espalha as reações pela tela)
function leftFor(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000
  return 12 + (h % 76) // 12%..88%
}

/** Overlay global: fumaça do cinzeiro e emotes sobem e somem, visíveis pra todos. */
export default function SocialLayer() {
  const reactions = useRoom((s) => s.reactions)

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <AnimatePresence>
        {reactions.map((r) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 20, scale: 0.6 }}
            animate={{ opacity: [0, 1, 1, 0], y: -220, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3.8, ease: 'easeOut', times: [0, 0.12, 0.7, 1] }}
            className="absolute bottom-24 flex flex-col items-center"
            style={{ left: `${leftFor(r.id)}%` }}
          >
            {r.kind === 'emote' ? (
              <span className="text-4xl drop-shadow-lg">{r.emoji}</span>
            ) : (
              <div className="relative flex flex-col items-center">
                <motion.span
                  animate={{ y: -28, opacity: [0.5, 0], scaleX: [1, 2.2] }}
                  transition={{ duration: 2.4, ease: 'easeOut' }}
                  className="absolute -top-6 h-8 w-5 rounded-full bg-white/40 blur-md"
                />
                <span className="text-3xl">🚬</span>
              </div>
            )}
            {r.name && (
              <span className="mt-0.5 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-bone-100 backdrop-blur-sm">
                {r.name}
              </span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
