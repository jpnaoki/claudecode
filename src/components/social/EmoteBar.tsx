import { useRoom } from '@/store/roomStore'

const EMOTES = ['👍', '😂', '🔥', '😱', '🍺', '👏']

/** Barra de reações ao vivo + cinzeiro compartilhado (broadcast pra todos da sala). */
export default function EmoteBar({ compact = false }: { compact?: boolean }) {
  const sendEmote = useRoom((s) => s.sendEmote)
  const sendSmoke = useRoom((s) => s.sendSmoke)
  const connected = useRoom((s) => s.status === 'connected')

  return (
    <div
      className={`panel flex items-center gap-1 rounded-full px-2 py-1.5 ${
        connected ? '' : 'opacity-50'
      }`}
    >
      <button
        onClick={sendSmoke}
        disabled={!connected}
        title="Acender um cigarro (todos veem)"
        className="grid h-9 w-9 place-items-center rounded-full text-lg transition-transform hover:scale-110 hover:bg-ember-500/20 active:scale-95"
      >
        🚬
      </button>
      <div className="mx-0.5 h-5 w-px bg-white/10" />
      {EMOTES.map((e) => (
        <button
          key={e}
          onClick={() => sendEmote(e)}
          disabled={!connected}
          className={`grid place-items-center rounded-full transition-transform hover:scale-110 hover:bg-white/10 active:scale-95 ${
            compact ? 'h-8 w-8 text-base' : 'h-9 w-9 text-lg'
          }`}
        >
          {e}
        </button>
      ))}
    </div>
  )
}
