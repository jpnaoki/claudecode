/**
 * Escala divergente centrada em zero, na convenção climatológica:
 * azul = anomalia fria, branco = neutro, vermelho = anomalia quente.
 *
 * O ponto de virada é o zero, não a média da série — é isso que faz a cor
 * significar a mesma coisa em qualquer painel do app.
 */

const PARADAS: ReadonlyArray<{ ate: number; fundo: string; texto: string }> = [
  { ate: -1.5, fundo: "#123f66", texto: "#ffffff" },
  { ate: -1.0, fundo: "#2c6ea3", texto: "#ffffff" },
  { ate: -0.5, fundo: "#7ba7c7", texto: "#0d2c47" },
  { ate: -0.2, fundo: "#d6e3ee", texto: "#123f66" },
  { ate: 0.2, fundo: "#f4f4f0", texto: "#3f3f3a" },
  { ate: 0.5, fundo: "#f6d9d2", texto: "#7d1d12" },
  { ate: 1.0, fundo: "#e8a891", texto: "#5c1409" },
  { ate: 1.5, fundo: "#e08b6f", texto: "#4a1007" },
  { ate: 2.0, fundo: "#c0392b", texto: "#ffffff" },
  { ate: Number.POSITIVE_INFINITY, fundo: "#7d1d12", texto: "#ffffff" },
];

export function corDaAnomalia(anomalia: number): { fundo: string; texto: string } {
  for (const parada of PARADAS) {
    if (anomalia < parada.ate) return { fundo: parada.fundo, texto: parada.texto };
  }
  const ultima = PARADAS[PARADAS.length - 1]!;
  return { fundo: ultima.fundo, texto: ultima.texto };
}

/** Cor de traço para linhas/pontos do gráfico. */
export function tracoDaAnomalia(anomalia: number): string {
  if (anomalia >= 0.5) return "#c0392b";
  if (anomalia <= -0.5) return "#2c6ea3";
  return "#a8a8a0";
}
