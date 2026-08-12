import type { SemanaObservada } from "@/lib/enso/tipos";
import { formatarAnomalia, formatarDataObs } from "@/lib/enso/formatar";

/**
 * Série temporal da anomalia da Niño 3.4, em SVG puro (sem biblioteca de
 * gráficos): são ~78 pontos, e o desenho à mão mantém o app leve, renderizável
 * no servidor e coerente com a estética enxuta.
 *
 * O preenchimento é dividido no zero por dois clipPaths — quente acima,
 * frio abaixo — para a cor manter o mesmo significado do resto do app.
 */

const L = 44; // margem esquerda (rótulos do eixo Y)
const R = 12;
const T = 12;
const B = 26;
const LARGURA = 720;
const ALTURA = 260;

/** Linhas de referência pedidas pelos limiares operacionais da CPC. */
const REFERENCIAS = [
  { v: 2.0, rotulo: "+2,0 muito forte", forte: true },
  { v: 1.5, rotulo: "+1,5 forte", forte: true },
  { v: 0.5, rotulo: "+0,5 limiar El Niño", forte: true },
  { v: -0.5, rotulo: "−0,5 limiar La Niña", forte: true },
];

export function GraficoAnomalia({ serie }: { serie: SemanaObservada[] }) {
  const valores = serie.map((s) => s.regioes.nino34.anomalia);
  const minDado = Math.min(...valores, -0.8);
  const maxDado = Math.max(...valores, 0.8);
  // Folga de 0,3 °C e arredondamento para meio grau, para o eixo não "colar".
  const min = Math.floor((minDado - 0.3) * 2) / 2;
  const max = Math.ceil((maxDado + 0.3) * 2) / 2;

  const x = (i: number) => L + (i * (LARGURA - L - R)) / Math.max(serie.length - 1, 1);
  const y = (v: number) => T + ((max - v) * (ALTURA - T - B)) / (max - min);

  const linha = serie
    .map((s, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(s.regioes.nino34.anomalia).toFixed(1)}`)
    .join(" ");

  const area =
    `${linha} L${x(serie.length - 1).toFixed(1)},${y(0).toFixed(1)} ` +
    `L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;

  const yZero = y(0);

  // Marcas do eixo X: uma a cada ~13 semanas (trimestre).
  const passo = Math.max(1, Math.round(serie.length / 6));
  const marcasX = serie
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => i % passo === 0 || i === serie.length - 1);

  const ultimo = serie[serie.length - 1];

  return (
    <figure className="mt-2">
      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Anomalia semanal da região Niño 3.4 nas últimas ${serie.length} semanas. Valor mais recente: ${ultimo ? formatarAnomalia(ultimo.regioes.nino34.anomalia) : "n/d"} graus Celsius.`}
      >
        <defs>
          <clipPath id="acimaDeZero">
            <rect x={L} y={T} width={LARGURA - L - R} height={Math.max(yZero - T, 0)} />
          </clipPath>
          <clipPath id="abaixoDeZero">
            <rect
              x={L}
              y={yZero}
              width={LARGURA - L - R}
              height={Math.max(ALTURA - B - yZero, 0)}
            />
          </clipPath>
        </defs>

        {/* Linhas de referência */}
        {REFERENCIAS.filter((r) => r.v > min && r.v < max).map((r) => (
          <g key={r.v}>
            <line
              x1={L}
              x2={LARGURA - R}
              y1={y(r.v)}
              y2={y(r.v)}
              stroke={r.v > 0 ? "#e0a99a" : "#9fbdd4"}
              strokeWidth={1}
              strokeDasharray="3 4"
            />
            <text
              x={LARGURA - R}
              y={y(r.v) - 4}
              textAnchor="end"
              className="tabular"
              fontSize={9}
              fill="#a8a8a0"
            >
              {r.rotulo}
            </text>
          </g>
        ))}

        {/* Eixo zero, mais firme que as referências */}
        <line x1={L} x2={LARGURA - R} y1={yZero} y2={yZero} stroke="#a8a8a0" strokeWidth={1} />

        {/* Preenchimento divergente */}
        <path d={area} fill="#c0392b" fillOpacity={0.16} clipPath="url(#acimaDeZero)" />
        <path d={area} fill="#2c6ea3" fillOpacity={0.16} clipPath="url(#abaixoDeZero)" />

        {/* A linha, também dividida no zero */}
        <path d={linha} fill="none" stroke="#c0392b" strokeWidth={1.6} clipPath="url(#acimaDeZero)" />
        <path d={linha} fill="none" stroke="#2c6ea3" strokeWidth={1.6} clipPath="url(#abaixoDeZero)" />

        {/* Ponto mais recente */}
        {ultimo && (
          <circle
            cx={x(serie.length - 1)}
            cy={y(ultimo.regioes.nino34.anomalia)}
            r={3}
            fill={ultimo.regioes.nino34.anomalia >= 0 ? "#c0392b" : "#2c6ea3"}
          />
        )}

        {/* Eixo Y */}
        {Array.from({ length: Math.round((max - min) * 2) + 1 }, (_, k) => min + k * 0.5)
          .filter((v) => Number.isFinite(v))
          .map((v) => (
            <text
              key={v}
              x={L - 8}
              y={y(v) + 3}
              textAnchor="end"
              className="tabular"
              fontSize={9}
              fill="#a8a8a0"
            >
              {formatarAnomalia(v)}
            </text>
          ))}

        {/* Eixo X */}
        {marcasX.map(({ s, i }) => (
          <text
            key={s.data}
            x={x(i)}
            y={ALTURA - 8}
            textAnchor={i === 0 ? "start" : i === serie.length - 1 ? "end" : "middle"}
            className="tabular"
            fontSize={9}
            fill="#a8a8a0"
          >
            {s.data.slice(0, 7)}
          </text>
        ))}
      </svg>

      <figcaption className="mt-1 text-[11px] text-tinta-500">
        Anomalia semanal da Niño 3.4, °C — últimas {serie.length} semanas
        {serie[0] && <> (de {formatarDataObs(serie[0].data)} a {formatarDataObs(serie[serie.length - 1]!.data)}, UTC)</>}.
      </figcaption>
    </figure>
  );
}
