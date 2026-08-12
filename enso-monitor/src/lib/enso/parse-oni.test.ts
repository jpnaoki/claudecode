import { describe, expect, it } from "vitest";
import { parsearOni, parsearRoni, rotularEstacao } from "./parse-oni";
import { ErroFormatoNoaa } from "./parse-semanal";

const ONI_FIXTURE = ` SEAS  YR   TOTAL   ANOM
  DJF 1950  25.01  -1.32
  JFM 1950  25.36  -1.20
  FMA 2026  27.34   0.11
  MAM 2026  28.09   0.46
  AMJ 2026  28.74   0.95
  MJJ 2026  29.02   1.39
`;

const RONI_FIXTURE = `SEAS   YR  ANOM
DJF  1950 -1.19
FMA  2026 -0.44
MJJ  2026  0.98
`;

describe("parsearOni", () => {
  const serie = parsearOni(ONI_FIXTURE);

  it("parseia estação, ano, SST total e anomalia", () => {
    expect(serie[0]).toEqual({ estacao: "DJF", ano: 1950, sstTotal: 25.01, anomalia: -1.32 });
    expect(serie[serie.length - 1]).toEqual({
      estacao: "MJJ",
      ano: 2026,
      sstTotal: 29.02,
      anomalia: 1.39,
    });
  });

  it("ordena por estação dentro do ano, não alfabeticamente", () => {
    const rotulos = serie.map((e) => `${e.estacao} ${e.ano}`);
    expect(rotulos).toEqual([
      "DJF 1950",
      "JFM 1950",
      "FMA 2026",
      "MAM 2026",
      "AMJ 2026",
      "MJJ 2026",
    ]);
  });

  it("ignora o cabeçalho e linhas em branco", () => {
    expect(serie).toHaveLength(6);
  });

  it("recusa arquivo sem o cabeçalho esperado", () => {
    expect(() => parsearOni("qualquer coisa\n1 2 3\n")).toThrow(ErroFormatoNoaa);
  });
});

describe("parsearRoni", () => {
  it("parseia o formato de 3 colunas", () => {
    const serie = parsearRoni(RONI_FIXTURE);
    expect(serie).toHaveLength(3);
    expect(serie[serie.length - 1]).toEqual({
      estacao: "MJJ",
      ano: 2026,
      sstTotal: null,
      anomalia: 0.98,
    });
  });
});

describe("rotularEstacao", () => {
  it("traduz o trigrama ambíguo para uma faixa legível", () => {
    expect(rotularEstacao("MJJ", 2026)).toBe("mai–jul de 2026");
    expect(rotularEstacao("DJF", 2026)).toBe("dez–fev de 2026");
    expect(rotularEstacao("JJA", 2026)).toBe("jun–ago de 2026");
  });
});
