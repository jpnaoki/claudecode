/**
 * Extração do nível de alerta do boletim de diagnóstico da CPC.
 *
 * A página é HTML solto e o status vem embrulhado em tags:
 *
 *   <strong>ENSO Alert System Status: </font>
 *   <a href="./enso-alert-readme.shtml" ...>
 *   <span style="color:red">El Ni&ntilde;o Advisory</span>
 *
 * Deliberadamente NÃO renderizamos texto arbitrário raspado da página: casamos
 * contra uma lista fechada dos status que o sistema de alerta da CPC pode ter.
 * Se nada casar, devolvemos null e a UI simplesmente omite o alerta — melhor
 * ausente do que um trecho de HTML de terceiro injetado na tela.
 */

const STATUS_CONHECIDOS: ReadonlyArray<{ padrao: RegExp; rotulo: string }> = [
  { padrao: /final\s+el\s+ni[nñ]o\s+advisory/i, rotulo: "Final El Niño Advisory" },
  { padrao: /final\s+la\s+ni[nñ]a\s+advisory/i, rotulo: "Final La Niña Advisory" },
  { padrao: /el\s+ni[nñ]o\s+advisory/i, rotulo: "El Niño Advisory" },
  { padrao: /la\s+ni[nñ]a\s+advisory/i, rotulo: "La Niña Advisory" },
  { padrao: /el\s+ni[nñ]o\s+watch/i, rotulo: "El Niño Watch" },
  { padrao: /la\s+ni[nñ]a\s+watch/i, rotulo: "La Niña Watch" },
  { padrao: /not\s+active/i, rotulo: "Not Active" },
];

/** Tradução curta para a UI. */
export const TRADUCAO_ALERTA: Record<string, string> = {
  "El Niño Advisory": "El Niño em curso (Advisory)",
  "La Niña Advisory": "La Niña em curso (Advisory)",
  "Final El Niño Advisory": "El Niño se encerrando (Final Advisory)",
  "Final La Niña Advisory": "La Niña se encerrando (Final Advisory)",
  "El Niño Watch": "Condições favoráveis a El Niño (Watch)",
  "La Niña Watch": "Condições favoráveis a La Niña (Watch)",
  "Not Active": "Sem alerta ativo",
};

function decodificar(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&ntilde;/gi, "ñ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ");
}

export function extrairAlerta(html: string): string | null {
  const marcador = /ENSO\s+Alert\s+System\s+Status/i.exec(html);
  if (!marcador) return null;

  // Janela curta depois do marcador: o status vem logo em seguida, e limitar o
  // alcance evita capturar uma menção solta mais adiante no texto do boletim.
  const janela = decodificar(html.slice(marcador.index, marcador.index + 600));

  for (const { padrao, rotulo } of STATUS_CONHECIDOS) {
    if (padrao.test(janela)) return rotulo;
  }
  return null;
}
