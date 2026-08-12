import type { EstacaoOni } from "./tipos";
import { ErroFormatoNoaa } from "./parse-semanal";

/**
 * Parsers dos arquivos sazonais da CPC.
 *
 * `oni.ascii.txt`  →  SEAS  YR  TOTAL  ANOM   (4 colunas)
 * `RONI.ascii.txt` →  SEAS  YR  ANOM          (3 colunas)
 *
 * Aqui o espaçamento é seguro (todo valor é precedido de pelo menos um espaço),
 * então a extração por expressão regular ancorada é suficiente — mas ainda
 * validamos o cabeçalho para não parsear um arquivo trocado.
 */

/** As 12 estações sobrepostas, em ordem dentro do ano rotulado. */
export const ESTACOES = [
  "DJF", "JFM", "FMA", "MAM", "AMJ", "MJJ",
  "JJA", "JAS", "ASO", "SON", "OND", "NDJ",
] as const;

const RE_ONI = /^\s*([A-Z]{3})\s+(\d{4})\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s*$/;
const RE_RONI = /^\s*([A-Z]{3})\s+(\d{4})\s+(-?\d+\.\d+)\s*$/;

function ordinal(estacao: string, ano: number): number {
  const i = ESTACOES.indexOf(estacao as (typeof ESTACOES)[number]);
  if (i < 0) throw new ErroFormatoNoaa(`Estação desconhecida: "${estacao}"`);
  return ano * 12 + i;
}

function ordenar(serie: EstacaoOni[]): EstacaoOni[] {
  return [...serie].sort((a, b) => ordinal(a.estacao, a.ano) - ordinal(b.estacao, b.ano));
}

export function parsearOni(texto: string): EstacaoOni[] {
  const linhas = texto.split(/\r?\n/);
  const cabecalho = linhas.find((l) => /SEAS/i.test(l));
  if (!cabecalho || !/ANOM/i.test(cabecalho)) {
    throw new ErroFormatoNoaa("Cabeçalho SEAS/ANOM não encontrado em oni.ascii.txt.");
  }

  const serie: EstacaoOni[] = [];
  for (const linha of linhas) {
    const m = RE_ONI.exec(linha);
    if (!m) continue;
    serie.push({
      estacao: m[1]!,
      ano: Number(m[2]),
      sstTotal: Number(m[3]),
      anomalia: Number(m[4]),
    });
  }
  if (serie.length === 0) throw new ErroFormatoNoaa("Nenhuma linha de ONI parseada.");
  return ordenar(serie);
}

export function parsearRoni(texto: string): EstacaoOni[] {
  const linhas = texto.split(/\r?\n/);
  const serie: EstacaoOni[] = [];
  for (const linha of linhas) {
    const m = RE_RONI.exec(linha);
    if (!m) continue;
    serie.push({
      estacao: m[1]!,
      ano: Number(m[2]),
      sstTotal: null,
      anomalia: Number(m[3]),
    });
  }
  if (serie.length === 0) throw new ErroFormatoNoaa("Nenhuma linha de RONI parseada.");
  return ordenar(serie);
}

// O trigrama é ambíguo em português (J pode ser jan/jun/jul), então mapeamos a
// faixa inteira por estação em vez de traduzir letra a letra.
const FAIXA_PT: Record<string, [string, string]> = {
  DJF: ["dez", "fev"], JFM: ["jan", "mar"], FMA: ["fev", "abr"], MAM: ["mar", "mai"],
  AMJ: ["abr", "jun"], MJJ: ["mai", "jul"], JJA: ["jun", "ago"], JAS: ["jul", "set"],
  ASO: ["ago", "out"], SON: ["set", "nov"], OND: ["out", "dez"], NDJ: ["nov", "jan"],
};

/** Rótulo legível de uma estação, ex.: ("MJJ", 2026) → "mai–jul de 2026". */
export function rotularEstacao(estacao: string, ano: number): string {
  const faixa = FAIXA_PT[estacao];
  return faixa ? `${faixa[0]}–${faixa[1]} de ${ano}` : `${estacao} ${ano}`;
}
