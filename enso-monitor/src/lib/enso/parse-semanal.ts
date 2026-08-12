import { REGIOES, type RegiaoId, type SemanaObservada, type LeituraRegiao } from "./tipos";

/**
 * Parser do arquivo semanal de índices Niño da NOAA CPC (`wksst9120.for`).
 *
 * O arquivo é de LARGURA FIXA, não delimitado. Anomalias negativas colam no
 * valor de SST anterior:
 *
 *      03JAN1990     23.4-0.4     25.1-0.3     26.6-0.0     28.6 0.3
 *                        ^^^^ sem espaço separador
 *
 * Por isso um `split(/\s+/)` produz 6 campos em linhas negativas e 9 em linhas
 * positivas — silenciosamente desalinhando as regiões. A estratégia aqui é:
 *
 *   1. ler a linha de rótulos para descobrir a ORDEM das regiões (não assumir);
 *   2. derivar as janelas de coluna a partir das primeiras linhas de dados;
 *   3. fatiar por posição e validar que toda linha respeita as mesmas janelas.
 *
 * Se a estrutura mudar, preferimos falhar alto a devolver número desalinhado.
 */

const MESES: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

/** Rótulos como aparecem no cabeçalho → id interno. */
const ROTULO_PARA_ID: Record<string, RegiaoId> = {
  "NINO1+2": "nino12",
  "NINO3": "nino3",
  "NINO34": "nino34",
  "NINO3.4": "nino34",
  "NINO4": "nino4",
};

const RE_LINHA_DADOS = /^\s*(\d{2}[A-Z]{3}\d{4})\s/;
/** Um campo numérico: opcional sinal, dígitos, ponto, 1+ decimais. */
const RE_NUMERO = /-?\d+\.\d+/g;

export interface Coluna {
  regiao: RegiaoId;
  sst: [number, number];
  ssta: [number, number];
}

export class ErroFormatoNoaa extends Error {
  override name = "ErroFormatoNoaa";
}

/** Converte "05AUG2026" em "2026-08-05" (data UTC da quarta-feira central). */
export function converterData(bruta: string): string {
  const dia = bruta.slice(0, 2);
  const mes = MESES[bruta.slice(2, 5).toUpperCase()];
  const ano = bruta.slice(5, 9);
  if (!mes) throw new ErroFormatoNoaa(`Mês não reconhecido em "${bruta}"`);
  return `${ano}-${String(mes).padStart(2, "0")}-${dia}`;
}

/**
 * Lê a linha de rótulos ("Nino1+2  Nino3  Nino34  Nino4") e devolve a ordem das
 * regiões tal como o arquivo as apresenta.
 */
export function lerOrdemRegioes(linhas: readonly string[]): RegiaoId[] {
  for (const linha of linhas.slice(0, 20)) {
    const achados = linha.match(/Nino\s?[0-9+.]+/gi);
    if (!achados || achados.length < 2) continue;
    const ids = achados.map((bruto) => {
      const chave = bruto.replace(/\s+/g, "").toUpperCase();
      const id = ROTULO_PARA_ID[chave];
      if (!id) throw new ErroFormatoNoaa(`Região desconhecida no cabeçalho: "${bruto}"`);
      return id;
    });
    return ids;
  }
  throw new ErroFormatoNoaa("Linha de rótulos das regiões não encontrada no arquivo.");
}

/**
 * Deriva as janelas de coluna a partir de uma linha de dados de referência.
 * Cada região contribui dois campos consecutivos: SST e depois SSTA.
 *
 * Detalhe que importa: os campos são ALINHADOS À DIREITA. O fim de cada token é
 * estável entre linhas, mas o começo não — numa linha negativa o sinal ocupa a
 * coluna que numa linha positiva fica em branco:
 *
 *      23.4-0.4     ← "-0.4" começa em 19
 *      25.4 3.8     ←  "3.8" começa em 20, e ambos terminam em 23
 *
 * Por isso a janela de cada campo vai do FIM do campo anterior até o FIM deste.
 * Assim ela cobre o espaço reservado ao sinal, e um `trim()` resolve os dois casos.
 */
export function derivarColunas(linhaDados: string, ordem: readonly RegiaoId[]): Coluna[] {
  const campos = [...linhaDados.matchAll(RE_NUMERO)];
  const esperados = ordem.length * 2;
  if (campos.length !== esperados) {
    throw new ErroFormatoNoaa(
      `Esperava ${esperados} campos numéricos na linha de referência, achei ${campos.length}: "${linhaDados}"`,
    );
  }

  const fimDe = (i: number) => campos[i]!.index + campos[i]![0].length;
  const janelas = campos.map(
    (m, i) => [i === 0 ? m.index : fimDe(i - 1), fimDe(i)] as [number, number],
  );

  return ordem.map((regiao, i) => ({
    regiao,
    sst: janelas[i * 2]!,
    ssta: janelas[i * 2 + 1]!,
  }));
}

function fatiarNumero(linha: string, [ini, fim]: [number, number], contexto: string): number {
  const bruto = linha.slice(ini, fim).trim();
  const valor = Number(bruto);
  if (bruto === "" || !Number.isFinite(valor)) {
    throw new ErroFormatoNoaa(`Campo inválido em [${ini},${fim}) — "${bruto}" (${contexto})`);
  }
  return valor;
}

export interface ResultadoSemanal {
  serie: SemanaObservada[];
  colunas: Coluna[];
}

export function parsearSemanal(texto: string): ResultadoSemanal {
  const linhas = texto.split(/\r?\n/);
  const ordem = lerOrdemRegioes(linhas);

  const linhasDados = linhas.filter((l) => RE_LINHA_DADOS.test(l));
  if (linhasDados.length === 0) {
    throw new ErroFormatoNoaa("Nenhuma linha de dados semanais encontrada.");
  }

  // Deriva colunas da primeira linha e confirma contra outra bem adiante —
  // se as duas discordarem, o arquivo não é de largura fixa como assumimos.
  const colunas = derivarColunas(linhasDados[0]!, ordem);
  const sonda = linhasDados[Math.floor(linhasDados.length / 2)]!;
  const colunasSonda = derivarColunas(sonda, ordem);
  for (let i = 0; i < colunas.length; i++) {
    const a = colunas[i]!;
    const b = colunasSonda[i]!;
    // Compara os FINS das janelas: é o que o alinhamento à direita mantém fixo.
    if (a.sst[1] !== b.sst[1] || a.ssta[1] !== b.ssta[1]) {
      throw new ErroFormatoNoaa(
        `Colunas instáveis para ${a.regiao}: linha 1 termina em ${a.sst[1]}/${a.ssta[1]}, ` +
          `linha ${Math.floor(linhasDados.length / 2)} em ${b.sst[1]}/${b.ssta[1]}.`,
      );
    }
  }

  const serie: SemanaObservada[] = [];
  for (const linha of linhasDados) {
    const data = converterData(RE_LINHA_DADOS.exec(linha)![1]!);

    // Fatia por posição…
    const regioes = {} as Record<RegiaoId, LeituraRegiao>;
    for (const col of colunas) {
      regioes[col.regiao] = {
        sst: fatiarNumero(linha, col.sst, `SST ${col.regiao} em ${data}`),
        anomalia: fatiarNumero(linha, col.ssta, `SSTA ${col.regiao} em ${data}`),
      };
    }

    // …e confere com uma varredura independente por regex. As duas leituras têm
    // de bater; senão a linha está fora do gabarito e não a publicamos.
    const varredura = linha.match(RE_NUMERO) ?? [];
    const porColuna = colunas.flatMap((c) => [
      linha.slice(...c.sst).trim(),
      linha.slice(...c.ssta).trim(),
    ]);
    if (varredura.length !== porColuna.length || varredura.some((v, i) => v !== porColuna[i])) {
      throw new ErroFormatoNoaa(
        `Linha fora do gabarito de largura fixa em ${data}: "${linha.trim()}"`,
      );
    }

    // Sanidade física. SST tropical fica confortavelmente entre 15 e 35 °C e as
    // anomalias históricas do arquivo não passam de ~5 °C. Um valor fora disso
    // não é "dado estranho": é sinal de que a derivação de colunas saiu do lugar.
    // Falhar aqui é melhor do que publicar uma leitura desalinhada com cara de boa.
    for (const [id, r] of Object.entries(regioes)) {
      if (r.sst < 10 || r.sst > 40) {
        throw new ErroFormatoNoaa(
          `SST implausível para ${id} em ${data}: ${r.sst} °C — provável desalinhamento de coluna.`,
        );
      }
      if (Math.abs(r.anomalia) > 12) {
        throw new ErroFormatoNoaa(
          `Anomalia implausível para ${id} em ${data}: ${r.anomalia} °C — provável desalinhamento de coluna.`,
        );
      }
    }

    serie.push({ data, regioes });
  }

  serie.sort((a, b) => a.data.localeCompare(b.data));

  const faltando = REGIOES.filter((r) => !ordem.includes(r));
  if (faltando.length > 0) {
    throw new ErroFormatoNoaa(`Regiões ausentes no arquivo: ${faltando.join(", ")}`);
  }

  return { serie, colunas };
}
