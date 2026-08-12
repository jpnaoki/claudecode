import { NextResponse } from "next/server";
import { obterEnso } from "@/lib/enso/servico";

/**
 * Única porta de entrada para os dados da NOAA.
 *
 * Existe porque os arquivos da CPC não mandam cabeçalho CORS: buscá-los do
 * browser é bloqueado pelo navegador. Todo acesso à NOAA acontece aqui, no
 * servidor, e o cliente recebe JSON já parseado e tipado.
 *
 * Também é o alvo do Vercel Cron (ver vercel.json), que a chama 1×/dia para
 * manter o cache quente sem exigir deploy manual.
 */

// A origem muda 1×/semana; revalidar de 6 em 6 h é folgado e educado.
export const revalidate = 21_600;
export const runtime = "nodejs";

export async function GET() {
  try {
    const dados = await obterEnso();
    return NextResponse.json(dados, {
      headers: {
        "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
      },
    });
  } catch (erro) {
    // Falhar visivelmente. Nunca devolver número inventado nem objeto meia-boca.
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    return NextResponse.json(
      {
        erro: "Não foi possível obter os dados da NOAA CPC.",
        detalhe: mensagem,
        emQue: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
