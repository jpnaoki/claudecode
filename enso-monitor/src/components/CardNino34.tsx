import type { BlocoSemanal } from "@/lib/enso/tipos";
import { formatarAnomalia, formatarDataObs, formatarSst } from "@/lib/enso/formatar";
import { corDaAnomalia } from "@/lib/enso/escala";
import { SeloProveniencia } from "./SeloProveniencia";

/** Seta de tendência: ↑ aquecendo, ↓ resfriando, → estável (|Δ| < 0,1 °C). */
function Tendencia({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-sm text-tinta-500">série curta demais para tendência</span>;
  }
  const d = Math.round(delta * 10) / 10;
  const seta = d >= 0.1 ? "↑" : d <= -0.1 ? "↓" : "→";
  const cor = d >= 0.1 ? "text-quente-forte" : d <= -0.1 ? "text-frio-forte" : "text-tinta-500";
  const palavra = d >= 0.1 ? "aquecendo" : d <= -0.1 ? "resfriando" : "estável";

  return (
    <span className={`inline-flex items-baseline gap-1.5 text-sm ${cor}`}>
      <span aria-hidden className="text-lg leading-none">
        {seta}
      </span>
      <span>
        {palavra} <span className="tabular">{formatarAnomalia(d)} °C</span> em 4 semanas
      </span>
    </span>
  );
}

export function CardNino34({ semanal }: { semanal: BlocoSemanal }) {
  const leitura = semanal.atual.regioes.nino34;
  const cor = corDaAnomalia(leitura.anomalia);

  return (
    <section className="rounded-sm border border-tinta-100 bg-white p-6 sm:p-8">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="rotulo">Niño 3.4 — leitura semanal</h2>
        <span className="rotulo">5°N–5°S, 170°W–120°W</span>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
        <div>
          <div
            className="tabular inline-block rounded-sm px-3 py-1 text-6xl font-light leading-none tracking-tight sm:text-7xl"
            style={{ backgroundColor: cor.fundo, color: cor.texto }}
          >
            {formatarAnomalia(leitura.anomalia)}
          </div>
          <p className="mt-2 text-xs text-tinta-500">anomalia de SST, °C</p>
        </div>

        <div className="pb-1">
          <p className="tabular text-2xl font-light text-tinta-700">
            {formatarSst(leitura.sst)} °C
          </p>
          <p className="mt-1 text-xs text-tinta-500">temperatura absoluta</p>
        </div>
      </div>

      <div className="mt-5 border-t border-tinta-100 pt-4">
        <Tendencia delta={semanal.deltaNino34} />
        {semanal.referencia4Semanas && (
          <p className="mt-1 text-[11px] text-tinta-500">
            comparado com{" "}
            <span className="tabular">
              {formatarAnomalia(semanal.referencia4Semanas.regioes.nino34.anomalia)} °C
            </span>{" "}
            em {formatarDataObs(semanal.referencia4Semanas.data)}
          </p>
        )}
      </div>

      <p className="mt-4 rounded-sm bg-tinta-50 p-3 text-[11px] leading-relaxed text-tinta-700">
        Esta é uma leitura <strong>semanal</strong>: rápida e ruidosa. Ela mostra para onde o
        oceano está indo, mas <strong>não</strong> classifica o estado do ENSO — isso é papel
        do ONI, ao lado.
      </p>

      <SeloProveniencia p={semanal.proveniencia} />
    </section>
  );
}
