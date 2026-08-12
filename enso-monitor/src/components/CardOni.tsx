import type { AlertaEnso, BlocoOni } from "@/lib/enso/tipos";
import { formatarAnomalia } from "@/lib/enso/formatar";
import { corDaAnomalia } from "@/lib/enso/escala";
import { rotularEstacao } from "@/lib/enso/parse-oni";
import { TRADUCAO_ALERTA } from "@/lib/enso/alerta";
import { SeloProveniencia } from "./SeloProveniencia";

/** Cinco casas: quantas estações consecutivas já cumpriram o limiar. */
function Persistencia({ n, atendido }: { n: number; atendido: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={`h-1.5 w-8 rounded-full ${i < Math.min(n, 5) ? "bg-tinta-900" : "bg-tinta-100"}`}
          />
        ))}
        {n > 5 && <span className="tabular text-xs text-tinta-500">+{n - 5}</span>}
      </div>
      <p className="mt-2 text-xs text-tinta-700">
        <span className="tabular">{n}</span> de 5 estações consecutivas acima do limiar —{" "}
        {atendido ? (
          <span className="text-tinta-900">critério de persistência atendido</span>
        ) : (
          <span>critério ainda não atendido</span>
        )}
      </p>
    </div>
  );
}

export function CardOni({ oni, alerta }: { oni: BlocoOni; alerta: AlertaEnso | null }) {
  const cor = corDaAnomalia(oni.atual.anomalia);
  const estacao = rotularEstacao(oni.atual.estacao, oni.atual.ano);

  return (
    <section className="rounded-sm border border-tinta-100 bg-white p-6 sm:p-8">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="rotulo">ONI — estado oficial</h2>
        <span className="rotulo">média móvel de 3 meses</span>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
        <div>
          <div
            className="tabular inline-block rounded-sm px-3 py-1 text-6xl font-light leading-none tracking-tight sm:text-7xl"
            style={{ backgroundColor: cor.fundo, color: cor.texto }}
          >
            {formatarAnomalia(oni.atual.anomalia)}
          </div>
          <p className="mt-2 text-xs text-tinta-500">°C — {estacao}</p>
        </div>

        <div className="pb-1">
          <p className="text-2xl font-light text-tinta-900">{oni.classificacao.rotulo}</p>
          <p className="mt-1 text-xs text-tinta-500">faixa de intensidade</p>
        </div>
      </div>

      <div className="mt-5 border-t border-tinta-100 pt-4">
        <Persistencia n={oni.estacoesConsecutivas} atendido={oni.criterioAtendido} />
      </div>

      {alerta && (
        <div className="mt-4 border-t border-tinta-100 pt-4">
          <p className="rotulo">Nível de alerta — boletim da CPC</p>
          <p className="mt-1.5 text-sm text-tinta-900">
            {TRADUCAO_ALERTA[alerta.status] ?? alerta.status}
          </p>
          <p className="text-[11px] text-tinta-500">
            status original: “{alerta.status}” —{" "}
            <a
              href={alerta.proveniencia.url}
              target="_blank"
              rel="noreferrer noopener"
              className="underline decoration-tinta-300 underline-offset-2 hover:text-tinta-900"
            >
              ENSO Diagnostic Discussion
            </a>
          </p>
        </div>
      )}

      {oni.roni !== null && (
        <div className="mt-4 border-t border-tinta-100 pt-4">
          <p className="rotulo">RONI — índice relativo</p>
          <p className="mt-1.5 text-sm text-tinta-900">
            <span className="tabular">{formatarAnomalia(oni.roni)} °C</span> na mesma estação
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-tinta-500">
            O RONI desconta o aquecimento médio dos trópicos. Quando fica abaixo do ONI, parte
            do sinal do índice tradicional vem da tendência de fundo, não do ENSO em si.
          </p>
        </div>
      )}

      <SeloProveniencia p={oni.proveniencia} />
    </section>
  );
}
