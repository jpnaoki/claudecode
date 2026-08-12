/**
 * Fontes de dados da NOAA CPC — todas consumidas **apenas no servidor**.
 * Os arquivos da NOAA não enviam cabeçalho CORS, então qualquer fetch feito no
 * browser é bloqueado; a rota /api/enso existe justamente para isso.
 *
 * NOTA DE PROVENIÊNCIA IMPORTANTE — períodos-base diferentes:
 *
 *   • A série SEMANAL (`wksst9120.for`) é OISST v2.1 com climatologia
 *     1991–2020 (daí o "9120" no nome).
 *   • O ONI (`oni.ascii.txt`) é ERSST v6 com período-base de 30 anos
 *     centrado, atualizado a cada 5 anos.
 *
 * Ou seja: as duas anomalias NÃO são a mesma quantidade e uma pequena
 * diferença entre elas é esperada, não é erro. A UI rotula as duas separadamente.
 *
 * O arquivo `wksst8110.for` (base 1981–2010), citado em material mais antigo,
 * está CONGELADO desde 27/01/2021 — a NOAA parou de atualizá-lo ao migrar para
 * a climatologia 1991–2020. Não usar.
 */

export const FONTES = {
  semanal: {
    nome: "NOAA CPC — índices Niño semanais (OISST v2.1)",
    url: "https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for",
    periodoBase: "climatologia 1991–2020 (OISST v2.1)",
    cadencia: "semanal, atualizado às segundas; cada linha é a quarta-feira central",
  },
  oni: {
    nome: "NOAA CPC — Oceanic Niño Index (ERSST v6)",
    url: "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt",
    periodoBase: "base de 30 anos centrada, revista a cada 5 anos (ERSST v6)",
    cadencia: "mensal",
  },
  roni: {
    nome: "NOAA CPC — Relative Oceanic Niño Index",
    url: "https://www.cpc.ncep.noaa.gov/data/indices/RONI.ascii.txt",
    periodoBase: "anomalia da Niño 3.4 menos a anomalia média dos trópicos (ERSST v6)",
    cadencia: "mensal",
  },
} as const;

/** Página canônica do boletim de diagnóstico, de onde sai o nível de alerta. */
export const URL_BOLETIM =
  "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml";

export interface TextoBruto {
  texto: string;
  coletadoEm: string;
  /** true quando este conteúdo veio do cache porque a origem falhou agora. */
  cacheObsoleto: boolean;
  /** Quando o conteúdo em cache foi originalmente coletado. */
  cacheDe: string | null;
}

/**
 * Último conteúdo bom de cada URL. Vive no escopo do módulo, ou seja, sobrevive
 * enquanto a instância serverless estiver quente. É uma rede de proteção para
 * quedas curtas da NOAA — não é persistência. Numa instância fria com a NOAA
 * fora do ar, a rota devolve erro explícito; nunca um número inventado.
 */
const ultimoBom = new Map<string, { texto: string; coletadoEm: string }>();

const TIMEOUT_MS = 20_000;

/**
 * Busca um arquivo-texto da NOAA. `revalidate` controla o cache de dados do
 * Next: a origem muda 1×/semana, então 6 h é folgado e educado com o servidor.
 */
export async function buscarTexto(
  url: string,
  revalidateSegundos = 21_600,
): Promise<TextoBruto> {
  const agora = new Date().toISOString();
  try {
    const resposta = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "enso-monitor (monitoramento pessoal de ENSO)" },
      next: { revalidate: revalidateSegundos },
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status} em ${url}`);

    const texto = await resposta.text();
    if (texto.trim().length === 0) throw new Error(`Resposta vazia em ${url}`);

    ultimoBom.set(url, { texto, coletadoEm: agora });
    return { texto, coletadoEm: agora, cacheObsoleto: false, cacheDe: null };
  } catch (erro) {
    const cache = ultimoBom.get(url);
    if (cache) {
      return {
        texto: cache.texto,
        coletadoEm: agora,
        cacheObsoleto: true,
        cacheDe: cache.coletadoEm,
      };
    }
    throw new Error(
      `Falha ao buscar ${url} e não há cópia em cache: ${(erro as Error).message}`,
      { cause: erro },
    );
  }
}
