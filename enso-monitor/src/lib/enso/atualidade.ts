import { ESTACOES } from "./parse-oni";

/**
 * Guarda de obsolescência da FONTE.
 *
 * Motivo de existir: `wksst8110.for` responde HTTP 200 até hoje, mas congelou em
 * 27/01/2021. Um app apontado para um arquivo assim não quebra — ele mostra dado
 * velho com cara de dado atual, que é a pior falha possível num painel de
 * monitoramento. Nenhuma verificação de rede pega isso: só comparar a DATA DE
 * OBSERVAÇÃO com o relógio pega.
 *
 * Por isso a checagem é da idade do dado, não da saúde do fetch.
 */

export type Situacao = "NORMAL" | "ATRASADA" | "PARADA";

export interface Atualidade {
  dias: number;
  situacao: Situacao;
  /** Explicação pronta para a UI. */
  nota: string | null;
}

const DIA_MS = 86_400_000;

function diasEntre(de: Date, ate: Date): number {
  return Math.floor((ate.getTime() - de.getTime()) / DIA_MS);
}

/**
 * Série semanal: cada linha é a quarta-feira central, publicada na segunda
 * seguinte. Na operação normal o dado mais recente tem de 5 a 12 dias.
 * 14 dias já é atraso; passando de 35, a fonte parou.
 */
export function avaliarAtualidadeSemanal(dataObs: string, agora: Date): Atualidade {
  const dias = diasEntre(new Date(`${dataObs}T00:00:00Z`), agora);

  if (dias > 35) {
    return {
      dias,
      situacao: "PARADA",
      nota:
        `A observação mais recente tem ${dias} dias. A série semanal da CPC é atualizada ` +
        `toda segunda — uma defasagem desta ordem indica que o arquivo parou de ser ` +
        `atualizado, não que o oceano parou. Confira se a NOAA migrou de arquivo.`,
    };
  }
  if (dias > 14) {
    return {
      dias,
      situacao: "ATRASADA",
      nota:
        `A observação mais recente tem ${dias} dias, acima do ciclo semanal normal ` +
        `(5 a 12 dias). Pode ser atraso pontual de publicação da CPC.`,
    };
  }
  return { dias, situacao: "NORMAL", nota: null };
}

/**
 * Mês central de uma estação sobreposta. O rótulo de ano da CPC segue o mês do
 * meio: "NDJ 2025" é nov/2025–jan/2026, "DJF 2026" é dez/2025–fev/2026.
 */
export function mesCentralDaEstacao(estacao: string): number {
  const i = ESTACOES.indexOf(estacao as (typeof ESTACOES)[number]);
  if (i < 0) throw new Error(`Estação desconhecida: "${estacao}"`);
  return i + 1;
}

/** Fim do trimestre da estação — é a partir daí que a CPC pode publicar o ONI. */
export function fimDaEstacao(estacao: string, ano: number): Date {
  const central = mesCentralDaEstacao(estacao);
  // Último dia do mês seguinte ao central: Date com dia 0 volta ao fim do mês anterior.
  return new Date(Date.UTC(ano, central + 1, 0));
}

/**
 * ONI: publicado uma vez por mês, algumas semanas depois de fechado o trimestre.
 * Até ~45 dias após o fim da estação é rotina; acima de 100 dias, parou.
 */
export function avaliarAtualidadeOni(
  estacao: string,
  ano: number,
  agora: Date,
): Atualidade {
  const dias = diasEntre(fimDaEstacao(estacao, ano), agora);

  if (dias > 100) {
    return {
      dias,
      situacao: "PARADA",
      nota:
        `A estação mais recente do ONI fechou há ${dias} dias. O índice é mensal — ` +
        `esta defasagem sugere que o arquivo parou de ser atualizado.`,
    };
  }
  if (dias > 45) {
    return {
      dias,
      situacao: "ATRASADA",
      nota:
        `A estação mais recente do ONI fechou há ${dias} dias, acima do ciclo mensal ` +
        `habitual de publicação.`,
    };
  }
  return { dias, situacao: "NORMAL", nota: null };
}
