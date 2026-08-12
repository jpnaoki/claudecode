import { obterEnso } from "@/lib/enso/servico";
import { formatarColeta } from "@/lib/enso/formatar";
import { CardNino34 } from "@/components/CardNino34";
import { CardOni } from "@/components/CardOni";
import { GradeRegioes } from "@/components/GradeRegioes";
import { GraficoAnomalia } from "@/components/GraficoAnomalia";

// ISR: a página se regenera sozinha de 6 em 6 h. Com o cron diário batendo na
// rota, o dado novo aparece sem deploy manual.
export const revalidate = 21_600;

function Falha({ mensagem }: { mensagem: string }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <p className="rotulo">Monitor ENSO</p>
      <h1 className="mt-3 text-2xl font-light">Dados indisponíveis no momento.</h1>
      <p className="mt-4 text-sm leading-relaxed text-tinta-700">
        Não foi possível obter os arquivos da NOAA CPC e não há cópia em cache nesta
        instância. Preferimos não mostrar nada a mostrar um número desatualizado sem aviso ou
        estimado.
      </p>
      <pre className="mt-6 overflow-x-auto rounded-sm bg-tinta-50 p-4 text-[11px] text-tinta-700">
        {mensagem}
      </pre>
      <p className="mt-6 text-xs text-tinta-500">
        A página tenta de novo automaticamente na próxima revalidação.
      </p>
    </main>
  );
}

export default async function Pagina() {
  let dados;
  try {
    dados = await obterEnso();
  } catch (erro) {
    return <Falha mensagem={erro instanceof Error ? erro.message : String(erro)} />;
  }

  const { semanal, oni, alerta, leitura } = dados;
  const emCache = semanal.proveniencia.cacheObsoleto || oni.proveniencia.cacheObsoleto;

  return (
    <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <header className="mb-10 sm:mb-14">
        <p className="rotulo">NOAA CPC · Pacífico equatorial</p>
        <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-4xl">Monitor ENSO</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-tinta-700">
          Temperatura da superfície do mar e anomalias das quatro regiões Niño, com o índice
          oficial ONI. Toda leitura traz fonte, data de observação e horário de coleta.
        </p>
      </header>

      {emCache && (
        <div className="mb-8 rounded-sm border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong className="font-medium">Origem indisponível.</strong> A NOAA não respondeu
          nesta atualização, então os números abaixo vêm da última coleta bem-sucedida. Cada
          selo mostra a idade real do dado.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <CardNino34 semanal={semanal} />
        <CardOni oni={oni} alerta={alerta} />
      </div>

      <section className="mt-5 rounded-sm border border-tinta-100 bg-white p-6 sm:p-8">
        <h2 className="rotulo">Leitura</h2>
        <div className="mt-3 max-w-3xl space-y-2.5">
          {leitura.map((frase, i) => (
            <p
              key={i}
              className={
                i === leitura.length - 1
                  ? "text-sm leading-relaxed text-tinta-500"
                  : "text-sm leading-relaxed text-tinta-900"
              }
            >
              {frase}
            </p>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-tinta-500">
          Texto gerado por regra determinística a partir dos números acima — sem modelo de
          linguagem no caminho.
        </p>
      </section>

      <section className="mt-5 rounded-sm border border-tinta-100 bg-white p-6 sm:p-8">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="rotulo">Série — anomalia da Niño 3.4</h2>
          <span className="rotulo">~18 meses</span>
        </div>
        <GraficoAnomalia serie={semanal.serie} />
      </section>

      <section className="mt-5">
        <h2 className="rotulo mb-3">As quatro regiões — semana de observação mais recente</h2>
        <GradeRegioes semanal={semanal} />
      </section>

      <footer className="mt-12 border-t border-tinta-100 pt-6 text-[11px] leading-relaxed text-tinta-500">
        <p>
          Anomalias de fontes distintas não são a mesma quantidade: a série semanal usa
          climatologia OISST v2.1 1991–2020; o ONI usa ERSST v6 com base de 30 anos centrada.
          Uma pequena diferença entre as duas é esperada.
        </p>
        <p className="mt-2">
          Datas de observação em UTC, como a NOAA publica. Horários de coleta em
          America/São_Paulo. Página gerada em{" "}
          <span className="tabular">{formatarColeta(dados.geradoEm)}</span>. Dados brutos em{" "}
          <a
            href="/api/enso"
            className="underline decoration-tinta-300 underline-offset-2 hover:text-tinta-900"
          >
            /api/enso
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
