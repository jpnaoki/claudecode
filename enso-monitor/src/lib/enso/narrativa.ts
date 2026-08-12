import type { BlocoOni, BlocoSemanal } from "./tipos";
import { formatarAnomalia, formatarDataObs } from "./formatar";
import { rotularEstacao } from "./parse-oni";

/**
 * Leitura interpretativa em PT-BR, gerada por REGRA — não por LLM. Determinística
 * e auditável: os mesmos números produzem sempre o mesmo texto.
 *
 * A terceira frase é obrigatória e não-negociável: é ela que impede o app de
 * ser lido como uma declaração de estado a partir de uma leitura semanal.
 */
export function montarLeitura(
  semanal: BlocoSemanal,
  oni: BlocoOni,
  alerta: string | null,
): string[] {
  const frases: string[] = [];

  // 1) Onde o ENSO está, oficialmente.
  const estacao = rotularEstacao(oni.atual.estacao, oni.atual.ano);
  const valorOni = formatarAnomalia(oni.atual.anomalia);
  if (oni.criterioAtendido) {
    frases.push(
      `O ONI mais recente (${estacao}) é de ${valorOni} °C — faixa de ` +
        `${oni.classificacao.rotulo} — com ${oni.estacoesConsecutivas} estações ` +
        `consecutivas acima do limiar de 0,5 °C, de modo que o critério de persistência ` +
        `da CPC (5 estações sobrepostas) está atendido.`,
    );
  } else if (oni.estacoesConsecutivas > 0) {
    frases.push(
      `O ONI mais recente (${estacao}) é de ${valorOni} °C, na faixa de ` +
        `${oni.classificacao.rotulo}, mas com apenas ${oni.estacoesConsecutivas} ` +
        `de 5 estações consecutivas acima do limiar — a persistência exigida pela CPC ` +
        `ainda não foi cumprida.`,
    );
  } else {
    frases.push(
      `O ONI mais recente (${estacao}) é de ${valorOni} °C, dentro da faixa neutra ` +
        `(−0,4 a +0,4 °C).`,
    );
  }

  // 2) O que a leitura semanal, mais rápida e mais ruidosa, está mostrando.
  const semanaAtual = semanal.atual.regioes.nino34;
  const delta = semanal.deltaNino34;
  const dataSemana = formatarDataObs(semanal.atual.data);
  let tendencia = "estável";
  if (delta !== null) {
    const d = Math.round(delta * 10) / 10;
    if (d >= 0.3) tendencia = "em aquecimento acelerado";
    else if (d >= 0.1) tendencia = "em aquecimento";
    else if (d <= -0.3) tendencia = "em resfriamento acelerado";
    else if (d <= -0.1) tendencia = "em resfriamento";
  }
  const trechoDelta =
    delta === null
      ? ""
      : ` (${formatarAnomalia(delta)} °C em 4 semanas)`;

  // A Niño 1+2 costuma liderar/exagerar em eventos de tipo canônico (leste).
  const leste = semanal.atual.regioes.nino12.anomalia;
  const centro = semanal.atual.regioes.nino4.anomalia;
  let padrao = "";
  if (leste - semanaAtual.anomalia >= 0.8) {
    padrao =
      ` O aquecimento está concentrado no Pacífico leste (Niño 1+2 em ` +
      `${formatarAnomalia(leste)} °C), padrão de El Niño canônico.`;
  } else if (centro - semanaAtual.anomalia >= 0.5) {
    padrao =
      ` O aquecimento está deslocado para o Pacífico central (Niño 4 em ` +
      `${formatarAnomalia(centro)} °C), padrão de tipo Modoki.`;
  }

  frases.push(
    `Na semana centrada em ${dataSemana} (UTC), a anomalia da Niño 3.4 está em ` +
      `${formatarAnomalia(semanaAtual.anomalia)} °C, ${tendencia}${trechoDelta}.${padrao}`,
  );

  // 3) A ressalva metodológica — sempre presente.
  const ressalva =
    `Leitura semanal não define estado: o ENSO só é classificado oficialmente pelo ONI ` +
    `(média móvel de 3 meses) sustentado por 5 estações consecutivas somado ao ` +
    `acoplamento atmosférico.`;
  frases.push(
    alerta
      ? `${ressalva} O status vigente no boletim da CPC é "${alerta}".`
      : ressalva,
  );

  return frases;
}
