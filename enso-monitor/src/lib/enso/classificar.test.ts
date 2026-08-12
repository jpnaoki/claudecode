import { describe, expect, it } from "vitest";
import { classificarOni, contarEstacoesConsecutivas } from "./classificar";

describe("classificarOni", () => {
  it("aplica a tabela de intensidade da CPC", () => {
    expect(classificarOni(2.4).rotulo).toBe("El Niño muito forte");
    expect(classificarOni(1.7).rotulo).toBe("El Niño forte");
    expect(classificarOni(1.39).rotulo).toBe("El Niño moderado");
    expect(classificarOni(0.7).rotulo).toBe("El Niño fraco");
    expect(classificarOni(0.1).rotulo).toBe("Neutro");
    expect(classificarOni(-0.3).rotulo).toBe("Neutro");
    expect(classificarOni(-0.7).rotulo).toBe("La Niña fraca");
    expect(classificarOni(-1.2).rotulo).toBe("La Niña moderada");
    expect(classificarOni(-1.8).rotulo).toBe("La Niña forte");
  });

  it("acerta as fronteiras exatas das faixas", () => {
    expect(classificarOni(2.0).rotulo).toBe("El Niño muito forte");
    expect(classificarOni(1.9).rotulo).toBe("El Niño forte");
    expect(classificarOni(1.5).rotulo).toBe("El Niño forte");
    expect(classificarOni(1.4).rotulo).toBe("El Niño moderado");
    expect(classificarOni(0.5).rotulo).toBe("El Niño fraco");
    expect(classificarOni(0.4).rotulo).toBe("Neutro");
    expect(classificarOni(-0.4).rotulo).toBe("Neutro");
    expect(classificarOni(-0.5).rotulo).toBe("La Niña fraca");
    expect(classificarOni(-1.5).rotulo).toBe("La Niña forte");
  });

  it("arredonda para 1 casa antes de comparar (0,45 é neutro, não El Niño)", () => {
    // 0.45 arredonda para 0.5 → entra na faixa fraca; 0.44 fica neutro.
    expect(classificarOni(0.44).rotulo).toBe("Neutro");
    expect(classificarOni(0.45).rotulo).toBe("El Niño fraco");
  });

  it("marca a fase corretamente", () => {
    expect(classificarOni(1.0).fase).toBe("QUENTE");
    expect(classificarOni(0.0).fase).toBe("NEUTRA");
    expect(classificarOni(-1.0).fase).toBe("FRIA");
  });
});

describe("contarEstacoesConsecutivas", () => {
  it("conta a sequência que termina na última estação", () => {
    expect(contarEstacoesConsecutivas([-0.2, 0.1, 0.5, 0.8, 1.1, 1.4])).toBe(4);
  });

  it("devolve 0 quando a última estação está na faixa neutra", () => {
    expect(contarEstacoesConsecutivas([1.2, 1.0, 0.6, 0.3])).toBe(0);
  });

  it("não atravessa troca de sinal", () => {
    expect(contarEstacoesConsecutivas([-1.2, -0.8, 0.6, 0.9])).toBe(2);
  });

  it("atende o critério oficial a partir de 5 estações", () => {
    const cinco = [0.5, 0.6, 0.7, 0.8, 0.9];
    expect(contarEstacoesConsecutivas(cinco)).toBe(5);
  });

  it("lida com série vazia", () => {
    expect(contarEstacoesConsecutivas([])).toBe(0);
  });
});
