import { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost' | 'gold'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-felt-600 hover:bg-felt-500 text-bone-50 border border-brass-500/30 shadow-[0_8px_24px_-8px_rgba(0,0,0,.6)]',
  gold:
    'text-ink font-bold bg-gradient-to-b from-brass-300 to-brass-500 hover:from-brass-300 hover:to-brass-400 border border-brass-600/50 shadow-[0_8px_24px_-8px_rgba(201,162,75,.6)]',
  ghost:
    'bg-white/5 hover:bg-white/10 text-bone-100 border border-white/10',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export default function Button({ variant = 'primary', className = '', ...rest }: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold tracking-wide transition-all duration-150 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  )
}
