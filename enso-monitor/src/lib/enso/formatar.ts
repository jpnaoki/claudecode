/** Formatação pt-BR. Regra do app: 1 casa decimal; anomalia sempre com sinal. */

const UMA_CASA = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Temperatura absoluta: "29,5". */
export function formatarSst(valor: number): string {
  return UMA_CASA.format(valor);
}

/**
 * Anomalia com sinal explícito sempre: "+2,6", "−0,4", "0,0".
 * Usa o sinal de menos tipográfico (U+2212), que alinha melhor que o hífen.
 */
export function formatarAnomalia(valor: number): string {
  const arredondado = Math.round(valor * 10) / 10;
  if (Object.is(arredondado, -0) || arredondado === 0) return "0,0";
  const sinal = arredondado > 0 ? "+" : "−";
  return `${sinal}${UMA_CASA.format(Math.abs(arredondado))}`;
}

/** Data de observação da NOAA (UTC) em formato brasileiro: "05/08/2026". */
export function formatarDataObs(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

const COLETA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Timestamp de coleta no fuso do usuário (America/São_Paulo). */
export function formatarColeta(iso: string): string {
  return COLETA.format(new Date(iso));
}

/** "há 3 dias", "há 5 h" — idade de um dado, para o aviso de cache. */
export function descreverIdade(desde: string, agora = new Date()): string {
  const ms = agora.getTime() - new Date(desde).getTime();
  const horas = Math.floor(ms / 3_600_000);
  if (horas < 1) return "há menos de 1 h";
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "há 1 dia" : `há ${dias} dias`;
}
