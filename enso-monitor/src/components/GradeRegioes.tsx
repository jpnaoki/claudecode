import { META_REGIOES, REGIOES, type BlocoSemanal } from "@/lib/enso/tipos";
import { formatarAnomalia, formatarSst } from "@/lib/enso/formatar";
import { corDaAnomalia } from "@/lib/enso/escala";

/** As quatro regiões Niño lado a lado, na ordem geográfica leste → oeste. */
export function GradeRegioes({ semanal }: { semanal: BlocoSemanal }) {
  const anterior = semanal.referencia4Semanas;

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-tinta-100 bg-tinta-100 sm:grid-cols-2 lg:grid-cols-4">
      {REGIOES.map((id) => {
        const meta = META_REGIOES[id];
        const leitura = semanal.atual.regioes[id];
        const cor = corDaAnomalia(leitura.anomalia);
        const delta = anterior
          ? leitura.anomalia - anterior.regioes[id].anomalia
          : null;

        return (
          <div key={id} className="bg-white p-5">
            <h3 className="text-sm font-medium text-tinta-900">{meta.rotulo}</h3>
            <p className="tabular mt-0.5 text-[10px] text-tinta-500">{meta.limites}</p>

            <div
              className="tabular mt-4 rounded-sm px-2 py-1.5 text-3xl font-light"
              style={{ backgroundColor: cor.fundo, color: cor.texto }}
            >
              {formatarAnomalia(leitura.anomalia)}
            </div>
            <p className="mt-1.5 text-[10px] uppercase tracking-rotulo text-tinta-500">
              anomalia, °C
            </p>

            <dl className="mt-4 space-y-1 text-xs text-tinta-700">
              <div className="flex justify-between gap-2">
                <dt className="text-tinta-500">SST</dt>
                <dd className="tabular">{formatarSst(leitura.sst)} °C</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-tinta-500">4 semanas</dt>
                <dd className="tabular">
                  {delta === null ? "—" : `${formatarAnomalia(delta)} °C`}
                </dd>
              </div>
            </dl>

            <p className="mt-3 border-t border-tinta-50 pt-2 text-[10px] leading-relaxed text-tinta-500">
              {meta.papel}
            </p>
          </div>
        );
      })}
    </div>
  );
}
