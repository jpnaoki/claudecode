import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Cliente Supabase (tempo real + dados).
 * Fica nulo até as variáveis de ambiente serem configuradas (.env) — assim o app
 * roda na Fase 0 sem backend e falamos com o Supabase a partir da Fase 1.
 */
export const supabase =
  url && anon
    ? createClient(url, anon, {
        realtime: { timeout: 20000 }, // mais tolerante em rede de celular
      })
    : null

export const hasBackend = Boolean(supabase)
