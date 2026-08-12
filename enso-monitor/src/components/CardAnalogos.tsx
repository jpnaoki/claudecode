import type { Analogo, ComparacaoNaEstacao } from "@/lib/enso/analogos";
import { CICLO } from "@/lib/enso/analogos";
import { formatarAnomalia } from "@/lib/enso/formatar";

/**
 * O evento em curso contra os El Niños fortes anteriores, alinhados por posição
 * no ciclo de vida (AMJ → MAM) e não por data de calendário.
 *
 * Cor com significado: cinza é história, vermelho é agora. Deliberadamente NÃO
 * usamos aqui a escala divergente azul-vermelho do resto do app — todos estes
 * eventos são quentes, e reaproveitar aquela escala sugeriria diferença de fase
 * onde só existe diferença de época.
 */

const L = 40;
const R = 16;
const T = 14;
const B = 34;
const LARGURA = 720;
const ALTURA = 300;

/** Cinzas graduados para os eventos passados; o mais recente é o mais escuro. */
const CINZAS = ["#cdcdc6", "#aeaea6", "#8d8d85", "#6b6b64"];
const COR_ATUAL = "#c0392b";

const ROTULO_ESTACAO: Record<string, string> = {
  AMJ: "abr–jun", MJJ: "mai–jul", JJA: "jun–ago", JAS: "jul–set",
  ASO: "ago–out", SON: "set–nov", OND: "out–dez", NDJ: "nov–jan",
  DJF: "dez–fev", JFM: "jan–mar", FMA: "fev–abr", MAM: "mar–mai",
};

function Leitura({ c }: { c: ComparacaoNaEstacao }) {
  const estacao = ROTULO_ESTACAO[c.estacao] ?? c.estacao;
  const lista = c.pares
    .map((p) => `${p.rotulo}: ${formatarAnomalia(p.valor)}`)
    .join("; ");

  let veredito: string;
  if (c.acimaDeTodos) {
    veredito =
      `Na mesma altura do ciclo (${estacao}), o evento em curso está em ` +
      `${formatarAnomalia(c.valorAtual)} °C — acima de todos os eventos comparados ` +
      `(${lista}).`;
  } else if (c.abaixoDeTodos) {
    veredito =
      `Na mesma altura do ciclo (${estacao}), o evento em curso está em ` +
      `${formatarAnomalia(c.valorAtual)} °C — abaixo de todos os comparados (${lista}).`;
  } else {
    veredito =
      `Na mesma altura do ciclo (${estacao}), o evento em curso está em ` +
      `${formatarAnomalia(c.valorAtual)} °C, dentro da faixa dos comparados (${lista}).`;
  }

  return (
    <div className="mt-4 max-w-3xl space-y-2">
      <p className="text-sm leading-relaxed text-tinta-900">{veredito}</p>
      <p className="text-sm leading-relaxed text-tinta-500">
        Estar à frente neste ponto não garante pico maior: a trajetória de um evento depende
        do acoplamento com a atmosfera nos meses seguintes, e eventos que largaram fortes já
        estagnaram antes. A comparação diz onde estamos, não onde vamos parar.
      </p>
    </div>
  );
}

export function CardAnalogos({
  analogos,
  comparacao,
}: {
  analogos: Analogo[];
  comparacao: ComparacaoNaEstacao | null;
}) {
  const todos = analogos.flatMap((a) => a.valores.filter((v): v is number => v !== null));
  if (todos.length === 0) return null;

  const min = Math.min(0, Math.floor(Math.min(...todos) * 2) / 2);
  const max = Math.ceil((Math.max(...todos) + 0.2) * 2) / 2;

  const x = (i: number) => L + (i * (LARGURA - L - R)) / (CICLO.length - 1);
  const y = (v: number) => T + ((max - v) * (ALTURA - T - B)) / (max - min);

  function caminho(valores: (number | null)[]): string {
    const partes: string[] = [];
    let abriu = false;
    valores.forEach((v, i) => {
      if (v === null) {
        abriu = false;
        return;
      }
      partes.push(`${abriu ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`);
      abriu = true;
    });
    return partes.join(" ");
  }

  const passados = analogos.filter((a) => !a.emCurso);
  const atual = analogos.find((a) => a.emCurso);

  return (
    <section className="rounded-sm border border-tinta-100 bg-white p-6 sm:p-8">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="rotulo">Contra os El Niños fortes anteriores</h2>
        <span className="rotulo">ONI alinhado por estação</span>
      </div>

      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        className="mt-4 h-auto w-full"
        role="img"
        aria-label={
          `Trajetória do ONI de eventos El Niño fortes, alinhados de abril–junho do ano ` +
          `de início até março–maio do ano seguinte. Eventos comparados: ` +
          `${analogos.map((a) => a.rotulo).join(", ")}.`
        }
      >
        {[0.5, 1.0, 1.5, 2.0, 2.5]
          .filter((v) => v > min && v < max)
          .map((v) => (
            <g key={v}>
              <line
                x1={L}
                x2={LARGURA - R}
                y1={y(v)}
                y2={y(v)}
                stroke="#e4e4de"
                strokeWidth={1}
                strokeDasharray={v === 0.5 ? "3 4" : undefined}
              />
              <text x={L - 8} y={y(v) + 3} textAnchor="end" className="tabular" fontSize={9} fill="#a8a8a0">
                {formatarAnomalia(v)}
              </text>
            </g>
          ))}

        {passados.map((a, i) => (
          <path
            key={a.anoInicio}
            d={caminho(a.valores)}
            fill="none"
            stroke={CINZAS[i % CINZAS.length]}
            strokeWidth={1.4}
          />
        ))}

        {atual && (
          <>
            <path d={caminho(atual.valores)} fill="none" stroke={COR_ATUAL} strokeWidth={2.4} />
            {atual.valores.map((v, i) =>
              v === null ? null : (
                <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill={COR_ATUAL} />
              ),
            )}
          </>
        )}

        {CICLO.map((estacao, i) => (
          <text
            key={estacao}
            x={x(i)}
            y={ALTURA - 12}
            textAnchor="middle"
            fontSize={8.5}
            fill="#a8a8a0"
          >
            {estacao}
          </text>
        ))}
        <text x={L} y={ALTURA - 1} textAnchor="start" fontSize={8} fill="#c9c9c2">
          ano do início →
        </text>
        <text x={LARGURA - R} y={ALTURA - 1} textAnchor="end" fontSize={8} fill="#c9c9c2">
          → ano seguinte
        </text>
      </svg>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[26rem] text-left text-xs">
          <thead>
            <tr className="border-b border-tinta-100 text-tinta-500">
              <th className="py-1.5 pr-3 font-normal">Evento</th>
              <th className="py-1.5 pr-3 font-normal">Pico do ONI</th>
              <th className="py-1.5 font-normal">Quando picou</th>
            </tr>
          </thead>
          <tbody>
            {analogos.map((a) => {
              const cor = a.emCurso
                ? COR_ATUAL
                : (CINZAS[passados.indexOf(a) % CINZAS.length] ?? CINZAS[0]!);
              return (
                <tr key={a.anoInicio} className="border-b border-tinta-50 last:border-0">
                  <td className="py-1.5 pr-3">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="inline-block h-0.5 w-4 shrink-0"
                        style={{ backgroundColor: cor }}
                      />
                      <span className={a.emCurso ? "font-medium text-tinta-900" : "text-tinta-700"}>
                        {a.rotulo}
                        {a.emCurso && " (em curso)"}
                      </span>
                    </span>
                  </td>
                  <td className="tabular py-1.5 pr-3 text-tinta-900">
                    {a.pico === null ? "—" : `${formatarAnomalia(a.pico)} °C`}
                    {a.emCurso && a.pico !== null && (
                      <span className="text-tinta-500"> até agora</span>
                    )}
                  </td>
                  <td className="py-1.5 text-tinta-500">
                    {a.estacaoDoPico
                      ? `${ROTULO_ESTACAO[a.estacaoDoPico] ?? a.estacaoDoPico}${a.emCurso ? " (parcial)" : ""}`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {comparacao && <Leitura c={comparacao} />}

      <p className="mt-4 text-[11px] leading-relaxed text-tinta-500">
        Mesma fonte e mesmo índice do card do ONI (NOAA CPC, ERSST v6): a comparação usa a
        série histórica completa do próprio arquivo, sem outra origem de dado.
      </p>
    </section>
  );
}
