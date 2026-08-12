import type { EstacaoOni } from "./tipos";
import { ESTACOES } from "./parse-oni";

/**
 * Comparação do evento em curso com El Niños fortes anteriores.
 *
 * O alinhamento é o ponto delicado. Comparar por data de calendário não diz
 * nada: eventos ENSO têm ciclo de vida atrelado à estação do ano, crescem no
 * inverno boreal e quase sempre picam em NDJ. Por isso alinhamos por POSIÇÃO NO
 * CICLO — AMJ do ano de início até MAM do ano seguinte — e não por data.
 *
 * Convenção de ano da CPC: o rótulo segue o mês central. AMJ…NDJ pertencem ao
 * ano de início; DJF…MAM já são do ano seguinte.
 */

/** As 12 estações do ciclo de vida de um evento, na ordem em que ele as percorre. */
export const CICLO = [
  "AMJ", "MJJ", "JJA", "JAS", "ASO", "SON",
  "OND", "NDJ", "DJF", "JFM", "FMA", "MAM",
] as const;

/** Quantas posições iniciais do ciclo pertencem ao ano de início. */
const POSICOES_NO_ANO_INICIAL = 8;

/** Eventos de referência: os El Niños fortes do registro moderno. */
export const EVENTOS_REFERENCIA = [1982, 1997, 2015, 2023] as const;

export interface Analogo {
  /** "1997–98" */
  rotulo: string;
  anoInicio: number;
  /** 12 valores de ONI na ordem de `CICLO`; null onde ainda não há dado. */
  valores: (number | null)[];
  /** Maior ONI observado no ciclo. Null se o evento ainda não tem dado. */
  pico: number | null;
  /** Estação em que o pico ocorreu. */
  estacaoDoPico: string | null;
  /** True para o evento em curso. */
  emCurso: boolean;
}

function rotularEvento(anoInicio: number): string {
  return `${anoInicio}–${String(anoInicio + 1).slice(2)}`;
}

/**
 * Descobre a que evento a estação mais recente pertence. Se estamos em AMJ…NDJ,
 * o evento começou neste ano; se em DJF…MAM, ele começou no ano anterior.
 */
export function anoDoEventoEmCurso(ultima: EstacaoOni): number {
  const i = ESTACOES.indexOf(ultima.estacao as (typeof ESTACOES)[number]);
  if (i < 0) throw new Error(`Estação desconhecida: "${ultima.estacao}"`);
  // ESTACOES começa em DJF; AMJ está no índice 4.
  const dentroDoAnoInicial = i >= ESTACOES.indexOf("AMJ");
  return dentroDoAnoInicial ? ultima.ano : ultima.ano - 1;
}

/** Extrai a trajetória de 12 estações de um evento a partir da série do ONI. */
export function trajetoriaDoEvento(
  serie: readonly EstacaoOni[],
  anoInicio: number,
): (number | null)[] {
  const indice = new Map(serie.map((e) => [`${e.estacao}${e.ano}`, e.anomalia]));
  return CICLO.map((estacao, i) => {
    const ano = i < POSICOES_NO_ANO_INICIAL ? anoInicio : anoInicio + 1;
    const v = indice.get(`${estacao}${ano}`);
    return v === undefined ? null : v;
  });
}

function montarUm(
  serie: readonly EstacaoOni[],
  anoInicio: number,
  emCurso: boolean,
): Analogo {
  const valores = trajetoriaDoEvento(serie, anoInicio);
  let pico: number | null = null;
  let estacaoDoPico: string | null = null;
  valores.forEach((v, i) => {
    if (v !== null && (pico === null || v > pico)) {
      pico = v;
      estacaoDoPico = CICLO[i]!;
    }
  });
  return { rotulo: rotularEvento(anoInicio), anoInicio, valores, pico, estacaoDoPico, emCurso };
}

export function montarAnalogos(
  serie: readonly EstacaoOni[],
  anoEmCurso: number,
  referencias: readonly number[] = EVENTOS_REFERENCIA,
): Analogo[] {
  // Um evento de referência que coincida com o ano em curso não deve aparecer
  // duas vezes.
  const passados = referencias.filter((a) => a !== anoEmCurso);
  return [
    ...passados.map((a) => montarUm(serie, a, false)),
    montarUm(serie, anoEmCurso, true),
  ];
}

export interface ComparacaoNaEstacao {
  /** Índice dentro de `CICLO` da estação mais avançada do evento em curso. */
  posicao: number;
  estacao: string;
  valorAtual: number;
  /** Valores dos eventos passados na MESMA posição do ciclo. */
  pares: { rotulo: string; valor: number }[];
  acimaDeTodos: boolean;
  abaixoDeTodos: boolean;
}

/**
 * Compara o evento em curso com os passados na mesma posição do ciclo — a única
 * comparação honesta enquanto o evento não terminou.
 */
export function compararNaMesmaEstacao(analogos: readonly Analogo[]): ComparacaoNaEstacao | null {
  const atual = analogos.find((a) => a.emCurso);
  if (!atual) return null;

  let posicao = -1;
  for (let i = atual.valores.length - 1; i >= 0; i--) {
    if (atual.valores[i] !== null) {
      posicao = i;
      break;
    }
  }
  if (posicao < 0) return null;

  const valorAtual = atual.valores[posicao]!;
  const pares = analogos
    .filter((a) => !a.emCurso)
    .map((a) => ({ rotulo: a.rotulo, valor: a.valores[posicao] }))
    .filter((p): p is { rotulo: string; valor: number } => p.valor !== null);

  return {
    posicao,
    estacao: CICLO[posicao]!,
    valorAtual,
    pares,
    acimaDeTodos: pares.length > 0 && pares.every((p) => valorAtual > p.valor),
    abaixoDeTodos: pares.length > 0 && pares.every((p) => valorAtual < p.valor),
  };
}
