import type { Proveniencia } from "@/lib/enso/tipos";
import { descreverIdade, formatarColeta, formatarDataObs } from "@/lib/enso/formatar";

/**
 * Selo de proveniência — mesmo papel do selo CONFIRMADO/ESTIMADO da calculadora
 * de custas: nenhum número aparece na tela sem dizer de onde veio, de quando é
 * a observação e quando nós fomos buscá-lo.
 *
 * Aqui todo dado é OBSERVADO (medição publicada pela NOAA). Não há valor
 * estimado no app — se algum dia entrar, ganha selo próprio, nunca este.
 */

function ehData(observadoEm: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(observadoEm);
}

export function SeloProveniencia({ p }: { p: Proveniencia }) {
  const observado = ehData(p.observadoEm) ? formatarDataObs(p.observadoEm) : p.observadoEm;

  return (
    <div className="mt-4 border-t border-tinta-100 pt-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex shrink-0 items-center rounded bg-tinta-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-rotulo text-tinta-700 ring-1 ring-inset ring-tinta-100">
          Observado
        </span>
        {p.cacheObsoleto && (
          <span className="inline-flex shrink-0 items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-rotulo text-amber-800 ring-1 ring-inset ring-amber-300">
            Cache — origem indisponível
          </span>
        )}
      </div>

      <dl className="mt-2 space-y-0.5 text-[11px] leading-relaxed text-tinta-500">
        <div className="flex gap-1.5">
          <dt className="shrink-0">Fonte:</dt>
          <dd>
            <a
              href={p.url}
              target="_blank"
              rel="noreferrer noopener"
              className="underline decoration-tinta-300 underline-offset-2 hover:text-tinta-900"
            >
              {p.fonte}
            </a>
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="shrink-0">Observação:</dt>
          <dd className="tabular">{observado} (UTC)</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="shrink-0">Coletado em:</dt>
          <dd className="tabular">
            {formatarColeta(p.coletadoEm)} (America/São_Paulo)
            {p.cacheObsoleto && <> — dado de {descreverIdade(p.coletadoEm)}</>}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="shrink-0">Base:</dt>
          <dd>{p.periodoBase}</dd>
        </div>
      </dl>
    </div>
  );
}
