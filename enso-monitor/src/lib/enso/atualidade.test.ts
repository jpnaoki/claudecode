import { describe, expect, it } from "vitest";
import {
  avaliarAtualidadeOni,
  avaliarAtualidadeSemanal,
  fimDaEstacao,
  mesCentralDaEstacao,
} from "./atualidade";

describe("avaliarAtualidadeSemanal", () => {
  const agora = new Date("2026-08-12T12:00:00Z");

  it("considera normal o ciclo semanal de 5 a 12 dias", () => {
    expect(avaliarAtualidadeSemanal("2026-08-05", agora).situacao).toBe("NORMAL");
    expect(avaliarAtualidadeSemanal("2026-08-05", agora).dias).toBe(7);
    expect(avaliarAtualidadeSemanal("2026-07-31", agora).situacao).toBe("NORMAL");
  });

  it("marca atraso passando de 14 dias", () => {
    const a = avaliarAtualidadeSemanal("2026-07-25", agora);
    expect(a.situacao).toBe("ATRASADA");
    expect(a.nota).toMatch(/acima do ciclo semanal/i);
  });

  it("marca fonte parada passando de 35 dias", () => {
    const a = avaliarAtualidadeSemanal("2026-06-01", agora);
    expect(a.situacao).toBe("PARADA");
    expect(a.nota).toMatch(/parou de ser atualizado/i);
  });

  it("pegaria o caso wksst8110: arquivo congelado em 2021 servido em 2026", () => {
    // Este é o cenário que motivou a guarda existir. O fetch dá 200, o parser
    // funciona, os números são válidos — e mesmo assim o painel estaria mentindo.
    const a = avaliarAtualidadeSemanal("2021-01-27", agora);
    expect(a.situacao).toBe("PARADA");
    expect(a.dias).toBeGreaterThan(2000);
  });
});

describe("mesCentralDaEstacao / fimDaEstacao", () => {
  it("usa o mês do meio, como faz o rótulo de ano da CPC", () => {
    expect(mesCentralDaEstacao("DJF")).toBe(1); // dez–jan–fev, meio = janeiro
    expect(mesCentralDaEstacao("MJJ")).toBe(6); // mai–jun–jul, meio = junho
    expect(mesCentralDaEstacao("NDJ")).toBe(12); // nov–dez–jan, meio = dezembro
  });

  it("fecha a estação no fim do mês seguinte ao central", () => {
    expect(fimDaEstacao("MJJ", 2026).toISOString().slice(0, 10)).toBe("2026-07-31");
    expect(fimDaEstacao("DJF", 2026).toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("vira o ano em NDJ, que termina em janeiro do ano seguinte", () => {
    expect(fimDaEstacao("NDJ", 2026).toISOString().slice(0, 10)).toBe("2027-01-31");
  });
});

describe("avaliarAtualidadeOni", () => {
  const agora = new Date("2026-08-12T12:00:00Z");

  it("aceita a defasagem mensal normal do índice", () => {
    // MJJ 2026 fecha em 31/07; 12 dias depois é publicação em dia.
    const a = avaliarAtualidadeOni("MJJ", 2026, agora);
    expect(a.situacao).toBe("NORMAL");
    expect(a.dias).toBe(12);
  });

  it("marca atraso passando de 45 dias do fim da estação", () => {
    expect(avaliarAtualidadeOni("MAM", 2026, agora).situacao).toBe("ATRASADA");
  });

  it("marca parada passando de 100 dias", () => {
    expect(avaliarAtualidadeOni("DJF", 2026, agora).situacao).toBe("PARADA");
  });
});
