/**
 * Tipos do domínio ENSO.
 *
 * Convenção de unidades: toda temperatura em °C. `sst` é temperatura absoluta
 * da superfície do mar; `anomalia` é o desvio em relação ao período-base da
 * respectiva fonte (que NÃO é o mesmo entre a série semanal e o ONI — ver
 * `fontes.ts`).
 */

export const REGIOES = ["nino12", "nino3", "nino34", "nino4"] as const;
export type RegiaoId = (typeof REGIOES)[number];

export interface RegiaoMeta {
  id: RegiaoId;
  /** Rótulo como a NOAA escreve no cabeçalho do arquivo. */
  rotulo: string;
  /** Limites geográficos, para exibição. */
  limites: string;
  papel: string;
}

export const META_REGIOES: Record<RegiaoId, RegiaoMeta> = {
  nino12: {
    id: "nino12",
    rotulo: "Niño 1+2",
    limites: "0°–10°S, 90°W–80°W",
    papel: "Costa do Peru/Equador; a mais volátil",
  },
  nino3: {
    id: "nino3",
    rotulo: "Niño 3",
    limites: "5°N–5°S, 150°W–90°W",
    papel: "Pacífico leste",
  },
  nino34: {
    id: "nino34",
    rotulo: "Niño 3.4",
    limites: "5°N–5°S, 170°W–120°W",
    papel: "Índice principal do ENSO",
  },
  nino4: {
    id: "nino4",
    rotulo: "Niño 4",
    limites: "5°N–5°S, 160°E–150°W",
    papel: "Pacífico central; menos variância",
  },
};

/** Uma leitura semanal de uma região. */
export interface LeituraRegiao {
  sst: number;
  anomalia: number;
}

/** Uma semana completa do arquivo semanal da CPC. */
export interface SemanaObservada {
  /** Data ISO (YYYY-MM-DD) da quarta-feira central da semana, em UTC. */
  data: string;
  regioes: Record<RegiaoId, LeituraRegiao>;
}

/** Uma estação (média móvel trimestral) do arquivo ONI. */
export interface EstacaoOni {
  /** Trigrama da estação sobreposta, ex.: "MJJ". */
  estacao: string;
  ano: number;
  /** SST total da Niño 3.4, °C. Ausente no arquivo do RONI. */
  sstTotal: number | null;
  /** A anomalia — este é o ONI propriamente dito. */
  anomalia: number;
}

export type ClasseEnso =
  | "EL_NINO_MUITO_FORTE"
  | "EL_NINO_FORTE"
  | "EL_NINO_MODERADO"
  | "EL_NINO_FRACO"
  | "NEUTRO"
  | "LA_NINA_FRACA"
  | "LA_NINA_MODERADA"
  | "LA_NINA_FORTE";

export interface Classificacao {
  classe: ClasseEnso;
  rotulo: string;
  /** Sinal do fenômeno: quente, frio ou neutro. */
  fase: "QUENTE" | "FRIA" | "NEUTRA";
}

/** Proveniência obrigatória de todo número exibido. */
export interface Proveniencia {
  fonte: string;
  url: string;
  /** Data da observação, como a NOAA publica (UTC). ISO ou rótulo de estação. */
  observadoEm: string;
  /** Timestamp ISO de quando este processo buscou o dado com sucesso. */
  coletadoEm: string;
  /** Período-base da anomalia — difere entre fontes. */
  periodoBase: string;
  /** true quando servimos cache porque a origem falhou agora. */
  cacheObsoleto: boolean;
  /**
   * Quando a origem está fora do ar, este é o instante da ÚLTIMA coleta
   * bem-sucedida — é ele que mede a idade real do dado. Null em operação normal.
   */
  cacheDe: string | null;
}

export interface BlocoSemanal {
  /** Série completa, ordem cronológica crescente. */
  serie: SemanaObservada[];
  atual: SemanaObservada;
  /** Semana de ~4 leituras atrás, para a seta de tendência. Null se a série for curta. */
  referencia4Semanas: SemanaObservada | null;
  /** Variação da anomalia da Niño 3.4 vs. `referencia4Semanas`. */
  deltaNino34: number | null;
  proveniencia: Proveniencia;
}

export interface BlocoOni {
  serie: EstacaoOni[];
  atual: EstacaoOni;
  classificacao: Classificacao;
  /** Nº de estações consecutivas com |ONI| ≥ 0,5 no mesmo sinal, até a atual. */
  estacoesConsecutivas: number;
  /** O critério oficial pede 5 estações sobrepostas consecutivas. */
  criterioAtendido: boolean;
  /** RONI da mesma estação, quando disponível (anomalia relativa aos trópicos). */
  roni: number | null;
  proveniencia: Proveniencia;
}

export interface AlertaEnso {
  status: string;
  proveniencia: Proveniencia;
}

export interface RespostaEnso {
  semanal: BlocoSemanal;
  oni: BlocoOni;
  alerta: AlertaEnso | null;
  leitura: string[];
  geradoEm: string;
}
