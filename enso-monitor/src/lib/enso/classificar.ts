import type { ClasseEnso, Classificacao } from "./tipos";

/**
 * Classificação por intensidade do pico do ONI (NOAA CPC).
 *
 * As faixas são fechadas nos dois extremos com 1 casa decimal: a tabela oficial
 * fala em "+1,5 a +1,9", o que na prática significa [1,5; 2,0). Usamos limites
 * abertos no topo para não deixar buraco entre faixas.
 */
const FAIXAS: ReadonlyArray<{
  min: number;
  classe: ClasseEnso;
  rotulo: string;
  fase: Classificacao["fase"];
}> = [
  { min: 2.0, classe: "EL_NINO_MUITO_FORTE", rotulo: "El Niño muito forte", fase: "QUENTE" },
  { min: 1.5, classe: "EL_NINO_FORTE", rotulo: "El Niño forte", fase: "QUENTE" },
  { min: 1.0, classe: "EL_NINO_MODERADO", rotulo: "El Niño moderado", fase: "QUENTE" },
  { min: 0.5, classe: "EL_NINO_FRACO", rotulo: "El Niño fraco", fase: "QUENTE" },
  { min: -0.4, classe: "NEUTRO", rotulo: "Neutro", fase: "NEUTRA" },
  { min: -0.9, classe: "LA_NINA_FRACA", rotulo: "La Niña fraca", fase: "FRIA" },
  { min: -1.4, classe: "LA_NINA_MODERADA", rotulo: "La Niña moderada", fase: "FRIA" },
  { min: Number.NEGATIVE_INFINITY, classe: "LA_NINA_FORTE", rotulo: "La Niña forte", fase: "FRIA" },
];

/**
 * Classifica um valor de ONI. Note que isto descreve a INTENSIDADE da faixa em
 * que o índice está — não afirma que o evento está oficialmente declarado. A
 * declaração exige persistência (5 estações) e acoplamento atmosférico, que é
 * avaliado em `avaliarPersistencia` e no boletim da CPC.
 */
export function classificarOni(oni: number): Classificacao {
  // Arredondamos para 1 casa antes de comparar: a tabela da CPC é definida em
  // décimos, e 0.4999 não deve virar "El Niño fraco" por erro de ponto flutuante.
  const v = Math.round(oni * 10) / 10;
  for (const faixa of FAIXAS) {
    if (v >= faixa.min) {
      return { classe: faixa.classe, rotulo: faixa.rotulo, fase: faixa.fase };
    }
  }
  // Inalcançável: a última faixa é -Infinity.
  return { classe: "NEUTRO", rotulo: "Neutro", fase: "NEUTRA" };
}

/**
 * Conta quantas estações consecutivas, terminando na última, mantêm |ONI| ≥ 0,5
 * com o mesmo sinal. O critério oficial da CPC pede 5 estações sobrepostas.
 */
export function contarEstacoesConsecutivas(anomalias: readonly number[]): number {
  if (anomalias.length === 0) return 0;
  const ultima = anomalias[anomalias.length - 1]!;
  const arredondada = Math.round(ultima * 10) / 10;
  if (Math.abs(arredondada) < 0.5) return 0;
  const sinal = Math.sign(arredondada);

  let n = 0;
  for (let i = anomalias.length - 1; i >= 0; i--) {
    const v = Math.round(anomalias[i]! * 10) / 10;
    if (Math.abs(v) >= 0.5 && Math.sign(v) === sinal) n++;
    else break;
  }
  return n;
}
