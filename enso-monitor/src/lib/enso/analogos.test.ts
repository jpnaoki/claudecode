import { describe, expect, it } from "vitest";
import {
  CICLO,
  anoDoEventoEmCurso,
  compararNaMesmaEstacao,
  montarAnalogos,
  trajetoriaDoEvento,
} from "./analogos";
import type { EstacaoOni } from "./tipos";

function est(estacao: string, ano: number, anomalia: number): EstacaoOni {
  return { estacao, ano, sstTotal: null, anomalia };
}

/** Recorte do ONI real: 1997–98 completo e 2026–27 até MJJ. */
const SERIE: EstacaoOni[] = [
  est("AMJ", 1997, 0.7), est("MJJ", 1997, 1.1), est("JJA", 1997, 1.5),
  est("JAS", 1997, 1.8), est("ASO", 1997, 2.0), est("SON", 1997, 2.2),
  est("OND", 1997, 2.3), est("NDJ", 1997, 2.4),
  est("DJF", 1998, 2.2), est("JFM", 1998, 1.9), est("FMA", 1998, 1.4),
  est("MAM", 1998, 1.0),
  est("AMJ", 2026, 0.95), est("MJJ", 2026, 1.39),
];

describe("anoDoEventoEmCurso", () => {
  it("atribui AMJ…NDJ ao ano de início do evento", () => {
    expect(anoDoEventoEmCurso(est("MJJ", 2026, 1.39))).toBe(2026);
    expect(anoDoEventoEmCurso(est("NDJ", 2026, 2.0))).toBe(2026);
    expect(anoDoEventoEmCurso(est("AMJ", 2026, 0.9))).toBe(2026);
  });

  it("atribui DJF…MAM ao evento que começou no ano anterior", () => {
    // Fev/2027 ainda é o El Niño 2026–27, não um evento novo de 2027.
    expect(anoDoEventoEmCurso(est("DJF", 2027, 2.1))).toBe(2026);
    expect(anoDoEventoEmCurso(est("MAM", 2027, 1.0))).toBe(2026);
  });
});

describe("trajetoriaDoEvento", () => {
  it("percorre AMJ do ano inicial até MAM do seguinte", () => {
    const t = trajetoriaDoEvento(SERIE, 1997);
    expect(t).toHaveLength(12);
    expect(t[0]).toBe(0.7); // AMJ 1997
    expect(t[7]).toBe(2.4); // NDJ 1997 — o pico
    expect(t[8]).toBe(2.2); // DJF 1998, já no ano seguinte
    expect(t[11]).toBe(1.0); // MAM 1998
  });

  it("devolve null onde ainda não há observação", () => {
    const t = trajetoriaDoEvento(SERIE, 2026);
    expect(t[0]).toBe(0.95);
    expect(t[1]).toBe(1.39);
    expect(t.slice(2).every((v) => v === null)).toBe(true);
  });

  it("não confunde eventos: o ano seguinte não puxa dado do evento errado", () => {
    const t = trajetoriaDoEvento(SERIE, 2025);
    // Não há nada de 2025–26 na série de teste.
    expect(t.every((v) => v === null)).toBe(true);
  });
});

describe("montarAnalogos", () => {
  const analogos = montarAnalogos(SERIE, 2026, [1997]);

  it("marca só o evento em curso", () => {
    expect(analogos.filter((a) => a.emCurso)).toHaveLength(1);
    expect(analogos.find((a) => a.emCurso)!.anoInicio).toBe(2026);
  });

  it("rotula o evento no formato 1997–98", () => {
    expect(analogos[0]!.rotulo).toBe("1997–98");
    expect(analogos.find((a) => a.emCurso)!.rotulo).toBe("2026–27");
  });

  it("acha o pico e a estação em que ele ocorreu", () => {
    const noventaESete = analogos.find((a) => a.anoInicio === 1997)!;
    expect(noventaESete.pico).toBe(2.4);
    expect(noventaESete.estacaoDoPico).toBe("NDJ");
  });

  it("não duplica um evento de referência que seja o próprio em curso", () => {
    const semDuplicata = montarAnalogos(SERIE, 1997, [1997, 2015]);
    expect(semDuplicata.filter((a) => a.anoInicio === 1997)).toHaveLength(1);
  });
});

describe("compararNaMesmaEstacao", () => {
  it("compara na posição mais avançada do evento em curso, não na última do ciclo", () => {
    const c = compararNaMesmaEstacao(montarAnalogos(SERIE, 2026, [1997]))!;
    expect(c.estacao).toBe("MJJ");
    expect(c.posicao).toBe(CICLO.indexOf("MJJ"));
    expect(c.valorAtual).toBe(1.39);
    // 1997 estava em +1,1 na mesma altura do ciclo — não no seu pico de +2,4.
    expect(c.pares).toEqual([{ rotulo: "1997–98", valor: 1.1 }]);
    expect(c.acimaDeTodos).toBe(true);
    expect(c.abaixoDeTodos).toBe(false);
  });

  it("devolve null se o evento em curso ainda não tem nenhuma observação", () => {
    expect(compararNaMesmaEstacao(montarAnalogos(SERIE, 2030, [1997]))).toBeNull();
  });
});
