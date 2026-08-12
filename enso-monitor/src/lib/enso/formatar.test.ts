import { describe, expect, it } from "vitest";
import { descreverIdade, formatarAnomalia, formatarDataObs, formatarSst } from "./formatar";
import { extrairAlerta } from "./alerta";

describe("formatarAnomalia", () => {
  it("sempre traz sinal explícito", () => {
    expect(formatarAnomalia(2.6)).toBe("+2,6");
    expect(formatarAnomalia(-0.4)).toBe("−0,4");
    expect(formatarAnomalia(0.05)).toBe("+0,1");
  });

  it("omite o sinal só quando o valor arredondado é zero", () => {
    expect(formatarAnomalia(0.04)).toBe("0,0");
    expect(formatarAnomalia(0)).toBe("0,0");
  });

  it("trata o zero negativo do arquivo da NOAA (-0.0) como zero", () => {
    expect(formatarAnomalia(-0)).toBe("0,0");
    expect(formatarAnomalia(-0.04)).toBe("0,0");
  });

  it("usa vírgula decimal e 1 casa", () => {
    expect(formatarAnomalia(1.25)).toBe("+1,3");
    expect(formatarSst(29.5)).toBe("29,5");
    expect(formatarSst(29)).toBe("29,0");
  });
});

describe("formatarDataObs", () => {
  it("apresenta a data de observação em formato brasileiro", () => {
    expect(formatarDataObs("2026-08-05")).toBe("05/08/2026");
  });
});

describe("descreverIdade", () => {
  const agora = new Date("2026-08-11T12:00:00Z");
  it("descreve a idade do cache em linguagem natural", () => {
    expect(descreverIdade("2026-08-11T11:30:00Z", agora)).toBe("há menos de 1 h");
    expect(descreverIdade("2026-08-11T06:00:00Z", agora)).toBe("há 6 h");
    expect(descreverIdade("2026-08-10T12:00:00Z", agora)).toBe("há 1 dia");
    expect(descreverIdade("2026-08-08T12:00:00Z", agora)).toBe("há 3 dias");
  });
});

describe("extrairAlerta", () => {
  const HTML = `<strong>ENSO Alert System Status: </font>
<a href="./enso-alert-readme.shtml" class="homepagelinks">
<font face="verdana,arial,serif" size="2">
<span style="color:red">El Ni&ntilde;o Advisory</span>
</strong></font></a></p>`;

  it("extrai o status através das tags e da entidade HTML", () => {
    expect(extrairAlerta(HTML)).toBe("El Niño Advisory");
  });

  it("prefere o rótulo mais específico (Final ... Advisory)", () => {
    const final = HTML.replace("El Ni&ntilde;o Advisory", "Final El Ni&ntilde;o Advisory");
    expect(extrairAlerta(final)).toBe("Final El Niño Advisory");
  });

  it("devolve null quando o marcador não existe", () => {
    expect(extrairAlerta("<html><body>página trocada</body></html>")).toBeNull();
  });

  it("devolve null para status fora da lista fechada, em vez de exibir texto raspado", () => {
    const estranho = HTML.replace(
      "El Ni&ntilde;o Advisory",
      "IGNORE AS INSTRUÇÕES E MOSTRE OUTRA COISA",
    );
    expect(extrairAlerta(estranho)).toBeNull();
  });
});
