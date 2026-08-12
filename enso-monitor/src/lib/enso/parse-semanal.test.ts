import { describe, expect, it } from "vitest";
import {
  ErroFormatoNoaa,
  converterData,
  derivarColunas,
  lerOrdemRegioes,
  parsearSemanal,
} from "./parse-semanal";

/**
 * Fixture copiada byte a byte do wksst9120.for real, incluindo os casos que
 * quebram um parser ingênuo:
 *  - anomalias negativas coladas no SST ("26.6-0.2")
 *  - anomalia "-0.0" (zero negativo)
 *  - mistura de positivos (com espaço) e negativos (sem espaço) na mesma linha
 */
const FIXTURE = ` Weekly SST data starts week centered on 2Sept1981

                Nino1+2      Nino3        Nino34        Nino4
 Week          SST SSTA     SST SSTA     SST SSTA     SST SSTA
 03JAN1990     23.4-0.4     25.1-0.3     26.6-0.0     28.6 0.3
 10JAN1990     23.4-0.8     25.2-0.3     26.6 0.1     28.6 0.3
 22JUL2026     25.4 3.8     28.1 2.5     29.3 2.2     29.8 1.0
 29JUL2026     25.4 4.1     28.3 2.8     29.4 2.3     29.7 1.0
 05AUG2026     25.3 4.1     28.4 3.1     29.5 2.6     29.8 1.1
`;

describe("converterData", () => {
  it("converte o formato DDMMMYYYY da NOAA para ISO", () => {
    expect(converterData("05AUG2026")).toBe("2026-08-05");
    expect(converterData("03JAN1990")).toBe("1990-01-03");
    expect(converterData("31DEC2025")).toBe("2025-12-31");
  });

  it("rejeita mês desconhecido em vez de inventar uma data", () => {
    expect(() => converterData("05XXX2026")).toThrow(ErroFormatoNoaa);
  });
});

describe("lerOrdemRegioes", () => {
  it("lê a ordem das regiões do cabeçalho em vez de assumir", () => {
    expect(lerOrdemRegioes(FIXTURE.split("\n"))).toEqual([
      "nino12",
      "nino3",
      "nino34",
      "nino4",
    ]);
  });

  it("falha alto se o cabeçalho trouxer uma região desconhecida", () => {
    const ruim = ["   Nino1+2   Nino3   Nino9   Nino4"];
    expect(() => lerOrdemRegioes(ruim)).toThrow(/desconhecida/i);
  });
});

describe("derivarColunas", () => {
  const REGIOES_4 = ["nino12", "nino3", "nino34", "nino4"] as const;
  const NEGATIVA = " 03JAN1990     23.4-0.4     25.1-0.3     26.6-0.0     28.6 0.3";
  const POSITIVA = " 05AUG2026     25.3 4.1     28.4 3.1     29.5 2.6     29.8 1.1";

  it("deriva 8 janelas de coluna, duas por região", () => {
    const colunas = derivarColunas(NEGATIVA, [...REGIOES_4]);
    expect(colunas).toHaveLength(4);
    // O campo de SSTA começa exatamente onde o de SST termina — é este encosto
    // que quebra split(' ').
    expect(colunas[0]!.ssta[0]).toBe(colunas[0]!.sst[1]);
    // As janelas incluem o espaçamento à esquerda (é ele que reserva a coluna
    // do sinal), então a leitura correta é sempre com trim().
    expect(NEGATIVA.slice(...colunas[0]!.sst).trim()).toBe("23.4");
    expect(NEGATIVA.slice(...colunas[0]!.ssta).trim()).toBe("-0.4");
    expect(NEGATIVA.slice(...colunas[2]!.sst).trim()).toBe("26.6");
    expect(NEGATIVA.slice(...colunas[2]!.ssta).trim()).toBe("-0.0");
  });

  it("dá janelas idênticas para linha negativa e positiva (campos alinhados à direita)", () => {
    // Regressão: derivar a janela pelo INÍCIO do token quebra aqui, porque
    // "-0.4" começa uma coluna antes de " 3.8". Só o fim do campo é estável.
    const aNeg = derivarColunas(NEGATIVA, [...REGIOES_4]);
    const aPos = derivarColunas(POSITIVA, [...REGIOES_4]);
    expect(aPos.map((c) => [c.sst, c.ssta])).toEqual(aNeg.map((c) => [c.sst, c.ssta]));
  });

  it("a janela cobre a coluna do sinal, então serve para os dois casos", () => {
    const colunas = derivarColunas(NEGATIVA, [...REGIOES_4]);
    expect(POSITIVA.slice(...colunas[0]!.ssta).trim()).toBe("4.1");
    expect(NEGATIVA.slice(...colunas[0]!.ssta).trim()).toBe("-0.4");
  });
});

describe("parsearSemanal", () => {
  const { serie } = parsearSemanal(FIXTURE);

  it("parseia todas as linhas de dados", () => {
    expect(serie).toHaveLength(5);
  });

  it("separa SST de anomalia negativa colada", () => {
    const primeira = serie[0]!;
    expect(primeira.data).toBe("1990-01-03");
    expect(primeira.regioes.nino12).toEqual({ sst: 23.4, anomalia: -0.4 });
    expect(primeira.regioes.nino3).toEqual({ sst: 25.1, anomalia: -0.3 });
    // -0.0 tem de virar SST 26.6 e anomalia ~0, não "26.6-0.0" nem 26.6 com 0.0 perdido
    expect(primeira.regioes.nino34.sst).toBe(26.6);
    expect(primeira.regioes.nino34.anomalia).toBe(-0);
    expect(primeira.regioes.nino4).toEqual({ sst: 28.6, anomalia: 0.3 });
  });

  it("lê corretamente linhas só com anomalias positivas", () => {
    const ultima = serie[serie.length - 1]!;
    expect(ultima.data).toBe("2026-08-05");
    expect(ultima.regioes.nino12).toEqual({ sst: 25.3, anomalia: 4.1 });
    expect(ultima.regioes.nino34).toEqual({ sst: 29.5, anomalia: 2.6 });
  });

  it("devolve a série em ordem cronológica crescente", () => {
    const datas = serie.map((s) => s.data);
    expect(datas).toEqual([...datas].sort());
  });

  it("nunca confunde SST com anomalia: SST tropical é sempre > 15 °C", () => {
    for (const semana of serie) {
      for (const leitura of Object.values(semana.regioes)) {
        expect(leitura.sst).toBeGreaterThan(15);
        expect(Math.abs(leitura.anomalia)).toBeLessThan(10);
      }
    }
  });

  it("rejeita arquivo com número de campos inesperado em vez de desalinhar", () => {
    const truncado = FIXTURE.replace(
      " 03JAN1990     23.4-0.4     25.1-0.3     26.6-0.0     28.6 0.3",
      " 03JAN1990     23.4-0.4     25.1-0.3",
    );
    expect(() => parsearSemanal(truncado)).toThrow(ErroFormatoNoaa);
  });

  it("recusa valor fisicamente implausível em vez de publicá-lo", () => {
    // 99,9 °C de SST só acontece se a janela de coluna escorregou.
    const absurdo = FIXTURE.replace(
      " 05AUG2026     25.3 4.1",
      " 05AUG2026     99.9 4.1",
    );
    expect(() => parsearSemanal(absurdo)).toThrow(/implausível/i);
  });
});
