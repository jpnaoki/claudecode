# Monitor ENSO — Pacífico equatorial

**No ar: https://enso-monitor-ruddy.vercel.app**

Acompanhamento da temperatura da superfície do mar (SST) e das anomalias nas quatro
regiões Niño, com o índice oficial ONI da NOAA CPC. Roda sozinho na Vercel e reflete o
dado mais recente sem intervenção manual.

## O que ele mostra

- **Niño 3.4 semanal** — anomalia atual, SST absoluta e tendência vs. 4 semanas atrás.
- **ONI oficial** — valor, faixa de intensidade, contagem de estações consecutivas acima
  do limiar e nível de alerta do boletim da CPC.
- **Série de ~18 meses** da anomalia da Niño 3.4, com linhas de referência em ±0,5 / +1,5 / +2,0 °C.
- **As quatro regiões** lado a lado (SST + anomalia + variação em 4 semanas).
- **Comparação com os El Niños fortes anteriores** (1982–83, 1997–98, 2015–16, 2023–24),
  alinhada por posição no ciclo de vida do evento.
- **Leitura em PT-BR** gerada por regra determinística — sem LLM no caminho.

## A regra que governa o app

O app **nunca** declara "é El Niño" a partir de uma leitura semanal. Ele mostra lado a
lado a anomalia semanal (rápida, ruidosa) e o ONI (defasado, autoritativo), e só o ONI
classifica o estado — com a ressalva de persistência sempre visível.

## Guarda de obsolescência da fonte

Um painel de monitoramento tem um modo de falha pior que quebrar: continuar funcionando
com dado velho. Nenhuma checagem de rede pega isso — o fetch dá 200, o parser roda, os
números são válidos. Só comparar a **data de observação** com o relógio pega.

`atualidade.ts` faz essa comparação e a UI reage: acima de 14 dias na série semanal marca
"fonte atrasada"; acima de 35, "fonte parada", com faixa vermelha no topo da página. O
mesmo vale para o ONI, com limiares mensais.

O caso que motivou a guarda é o do `wksst8110.for` (ver abaixo) — e ele está coberto por
teste: um arquivo congelado em 2021 servido em 2026 é classificado como `PARADA`.

## Comparação com eventos anteriores

O card de análogos põe o evento em curso contra os El Niños fortes do registro moderno.
O alinhamento é o ponto delicado: comparar por data de calendário não diz nada, porque o
ciclo de vida do ENSO é atrelado à estação do ano e quase sempre pica em NDJ. Por isso as
trajetórias são alinhadas por **posição no ciclo** — AMJ do ano de início até MAM do ano
seguinte — e a comparação numérica é sempre feita na mesma posição, nunca contra o pico
alheio.

A leitura vem com a ressalva de que estar à frente num ponto do ciclo não garante pico
maior. A cor também carrega significado: cinza é história, vermelho é o evento em curso —
a escala divergente azul-vermelho do resto do app **não** é reaproveitada aqui, porque
todos estes eventos são quentes e ela sugeriria diferença de fase onde só há diferença de
época.

## Fontes

| Papel | Arquivo | Cadência |
|---|---|---|
| Índices semanais das 4 regiões | [`wksst9120.for`](https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for) | semanal (segundas) |
| ONI oficial | [`oni.ascii.txt`](https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt) | mensal |
| RONI (índice relativo) | [`RONI.ascii.txt`](https://www.cpc.ncep.noaa.gov/data/indices/RONI.ascii.txt) | mensal |
| Nível de alerta | [ENSO Diagnostic Discussion](https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml) | mensal |

### Duas armadilhas de proveniência

1. **`wksst8110.for` está morto.** O arquivo de base 1981–2010, citado em material mais
   antigo, congelou em **27/01/2021** — a NOAA parou de atualizá-lo ao migrar para a
   climatologia 1991–2020. Ele ainda responde HTTP 200, o que o torna especialmente
   traiçoeiro: um app apontado para lá mostra dado de 2021 com cara de dado atual. Use
   `wksst9120.for`.

2. **As duas anomalias não são a mesma quantidade.** A série semanal é OISST v2.1 com
   climatologia 1991–2020; o ONI é ERSST v6 com base de 30 anos centrada, revista a cada
   5 anos. Uma pequena diferença entre elas é esperada, não é erro. Os selos rotulam a
   base de cada uma.

## O parser

O arquivo semanal é de **largura fixa**, e anomalias negativas colam no SST anterior:

```
 03JAN1990     23.4-0.4     25.1-0.3     26.6-0.0     28.6 0.3
                   ^^^^ sem espaço separador
```

Um `split(/\s+/)` devolve 6 campos aqui e 9 numa linha só de positivos — desalinhando as
regiões silenciosamente. `parse-semanal.ts` lê a ordem das regiões no cabeçalho, deriva as
janelas de coluna a partir das linhas de dados em runtime, fatia por posição e valida cada
linha contra uma varredura independente. Se a estrutura mudar, ele **falha alto** em vez de
publicar número desalinhado.

Validado contra o arquivo real: 2.345 linhas, de 02/09/1981 a hoje, zero divergências.

## Rodando localmente

```bash
npm install
```

```bash
npm run dev
```

Abre em http://localhost:3000. Os dados vêm da NOAA a cada build/revalidação — não há
banco, não há chave de API, não há configuração.

Testes e checagem de tipos:

```bash
npm test
```

```bash
npm run typecheck
```

## Deploy na Vercel

Já publicado como projeto `enso-monitor` (escopo `jp-naoki-s-projects`), em
https://enso-monitor-ruddy.vercel.app.

Para republicar depois de mudanças, a partir deste diretório:

```bash
npx vercel deploy --prod
```

O projeto é autocontido e o link com a Vercel já está gravado em `.vercel/` (fora do
versionamento). Num clone novo, `npx vercel link` refaz o vínculo. Framework preset:
Next.js, detectado sozinho.

### Cron

O [`vercel.json`](vercel.json) já registra o cron:

```json
{ "crons": [{ "path": "/api/enso", "schedule": "0 14 * * *" }] }
```

Ele chama `/api/enso` uma vez por dia (14:00 UTC ≈ 11:00 em Brasília, depois da
atualização de segunda da CPC) para manter o cache quente. A fonte muda 1×/semana, então
uma batida diária é folgada — nada de polling agressivo contra o servidor da NOAA.

Registrado e confirmado no projeto:

```bash
npx vercel crons ls
```

Mesmo que o cron falhe, o app continua se atualizando pela revalidação de 6 h (ISR) — o
cron é só o aquecimento programado, não a única via.

## Arquitetura

```
src/lib/enso/     domínio puro, testável, sem React
  fontes.ts         URLs + fetch com timeout e cache de proteção
  parse-semanal.ts  parser de largura fixa (o coração do rigor)
  parse-oni.ts      parsers ONI e RONI
  classificar.ts    tabela de intensidade + persistência de 5 estações
  atualidade.ts     guarda de obsolescência da fonte
  analogos.ts       alinhamento de eventos por posição no ciclo
  narrativa.ts      leitura PT-BR por regra
  escala.ts         escala divergente centrada em zero
src/app/api/enso  única porta para a NOAA (resolve o CORS)
src/components    UI
```

**Todo acesso à NOAA é server-side.** Os arquivos da CPC não mandam cabeçalho CORS, então
fetch a partir do browser é bloqueado — a rota `/api/enso` existe exatamente para isso, e
devolve JSON já parseado e tipado.

### Se a NOAA cair

`fontes.ts` guarda a última resposta boa de cada URL no escopo do módulo. Numa queda curta,
a UI serve esse conteúdo com faixa de aviso e a **idade real** do dado em cada selo. Numa
instância fria e com a NOAA fora do ar não há o que servir: a página mostra um estado de
falha explícito. Em nenhum caminho ela inventa número.

## Não implementado (de propósito)

- **Curva diária (OISST/ERDDAP).** O ganho é pequeno — a fonte semanal já é a referência
  operacional da CPC — e o custo é real: exige média da região ponderada por `cos(latitude)`
  para não enviesar a anomalia. Vale como próximo passo, não como v1.
- **Supabase.** A fonte primária já traz a série histórica completa desde 1981. Só faria
  sentido para anotações próprias na timeline.
