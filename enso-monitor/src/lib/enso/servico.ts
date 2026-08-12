import { FONTES, URL_BOLETIM, buscarTexto } from "./fontes";
import { parsearSemanal } from "./parse-semanal";
import { parsearOni, parsearRoni } from "./parse-oni";
import { classificarOni, contarEstacoesConsecutivas } from "./classificar";
import { extrairAlerta } from "./alerta";
import { avaliarAtualidadeOni, avaliarAtualidadeSemanal } from "./atualidade";
import { anoDoEventoEmCurso, compararNaMesmaEstacao, montarAnalogos } from "./analogos";
import { montarLeitura } from "./narrativa";
import type { TextoBruto } from "./fontes";
import type {
  BlocoOni,
  BlocoSemanal,
  Proveniencia,
  RespostaEnso,
  SemanaObservada,
} from "./tipos";

/** Quantas semanas o gráfico mostra (~18 meses). */
export const SEMANAS_NO_GRAFICO = 78;

/** A seta de tendência compara com 4 semanas atrás. */
const DEFASAGEM_TENDENCIA = 4;

function proveniencia(
  fonte: { nome: string; url: string; periodoBase: string },
  observadoEm: string,
  bruto: TextoBruto,
): Proveniencia {
  return {
    fonte: fonte.nome,
    url: fonte.url,
    observadoEm,
    // Servindo cache, o carimbo honesto de coleta é o da última busca que deu
    // certo — não o instante em que a tentativa de agora falhou.
    coletadoEm: bruto.cacheDe ?? bruto.coletadoEm,
    periodoBase: fonte.periodoBase,
    cacheObsoleto: bruto.cacheObsoleto,
    cacheDe: bruto.cacheDe,
  };
}

/**
 * Monta a resposta completa do app. Cada bloco carrega sua própria proveniência
 * porque as fontes têm cadências e períodos-base diferentes — misturar os dois
 * carimbos seria enganoso.
 */
export async function obterEnso(agora = new Date()): Promise<RespostaEnso> {
  // Semanal e ONI são obrigatórios; RONI e boletim são contexto opcional e não
  // podem derrubar a página se falharem.
  const [brutoSemanal, brutoOni] = await Promise.all([
    buscarTexto(FONTES.semanal.url),
    buscarTexto(FONTES.oni.url),
  ]);

  const { serie } = parsearSemanal(brutoSemanal.texto);
  if (serie.length === 0) throw new Error("Série semanal vazia após o parse.");

  const atual = serie[serie.length - 1]!;
  const idxRef = serie.length - 1 - DEFASAGEM_TENDENCIA;
  const referencia4Semanas: SemanaObservada | null = idxRef >= 0 ? serie[idxRef]! : null;
  const deltaNino34 = referencia4Semanas
    ? atual.regioes.nino34.anomalia - referencia4Semanas.regioes.nino34.anomalia
    : null;

  const semanal: BlocoSemanal = {
    serie: serie.slice(-SEMANAS_NO_GRAFICO),
    atual,
    referencia4Semanas,
    deltaNino34,
    atualidade: avaliarAtualidadeSemanal(atual.data, agora),
    proveniencia: proveniencia(FONTES.semanal, atual.data, brutoSemanal),
  };

  const serieOni = parsearOni(brutoOni.texto);
  const atualOni = serieOni[serieOni.length - 1]!;
  const estacoesConsecutivas = contarEstacoesConsecutivas(serieOni.map((e) => e.anomalia));

  // RONI é contexto útil (desconta o aquecimento médio dos trópicos), mas sua
  // ausência não invalida nada.
  let roni: number | null = null;
  try {
    const brutoRoni = await buscarTexto(FONTES.roni.url);
    const serieRoni = parsearRoni(brutoRoni.texto);
    const par = serieRoni.find(
      (e) => e.estacao === atualOni.estacao && e.ano === atualOni.ano,
    );
    roni = par ? par.anomalia : null;
  } catch {
    roni = null;
  }

  const oni: BlocoOni = {
    serie: serieOni.slice(-24),
    atual: atualOni,
    classificacao: classificarOni(atualOni.anomalia),
    estacoesConsecutivas,
    criterioAtendido: estacoesConsecutivas >= 5,
    roni,
    atualidade: avaliarAtualidadeOni(atualOni.estacao, atualOni.ano, agora),
    proveniencia: proveniencia(FONTES.oni, `${atualOni.estacao} ${atualOni.ano}`, brutoOni),
  };

  let alerta: RespostaEnso["alerta"] = null;
  try {
    const brutoBoletim = await buscarTexto(URL_BOLETIM);
    const status = extrairAlerta(brutoBoletim.texto);
    if (status) {
      alerta = {
        status,
        proveniencia: proveniencia(
          {
            nome: "NOAA CPC — ENSO Diagnostic Discussion",
            url: URL_BOLETIM,
            periodoBase: "n/a (status qualitativo)",
          },
          "boletim mensal vigente",
          brutoBoletim,
        ),
      };
    }
  } catch {
    alerta = null;
  }

  // Análogos usam a série COMPLETA do ONI (vai a 1950), não o recorte de 24
  // estações que a UI desenha.
  const analogos = montarAnalogos(serieOni, anoDoEventoEmCurso(atualOni));

  return {
    semanal,
    oni,
    alerta,
    analogos,
    comparacao: compararNaMesmaEstacao(analogos),
    leitura: montarLeitura(semanal, oni, alerta?.status ?? null),
    geradoEm: agora.toISOString(),
  };
}
