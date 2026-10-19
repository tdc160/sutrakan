# Chácara Santo Expedito

Sistema em português para controle da criação de galinhas caipiras. Desenvolvido com JavaScript e Vite, sem dependência de servidor de dados.

## Executar

Requer Node.js 22 ou superior e npm.

```sh
npm ci --cache /tmp/npm-cache
npm run dev -- --port 5173
```

Para produção: `npm run build`. Para conferir a compilação: `npm run preview -- --port 4173`.

## Controles

- Saldo inicial informado: aproximadamente 200 aves adultas a distribuir entre galpões e 70 pintinhos no galpão 1. Os demais três galpões começam sem aves atribuídas; não se presume sua distribuição física.
- Nascimentos, mortalidade, transferências e vendas de aves atualizam o plantel. As saídas são limitadas ao saldo disponível.
- Coletas e vendas de ovos são registradas em unidades. Uma dúzia corresponde a 12 unidades.
- Despesas de ração registram ingrediente, kg e valor total. Itens disponíveis: quirera de milho, núcleos de engorda/início/crescimento/postura, farelos de soja e trigo, calcário calcítico, ração pronta e outro ingrediente (detalhe em observações). Medicamentos e outros gastos registram quantidade e valor total.
- O Financeiro agrupa compras para a ração por ingrediente, com kg, gasto total e custo médio ponderado por kg (gasto dividido pelos kg comprados). Registros antigos sem ingrediente permanecem em Ração sem detalhamento; não são classificados automaticamente. Novos backups mantêm esse campo e backups anteriores continuam compatíveis.
- O detalhamento registra despesas e não contabiliza estoque ou consumo de ingredientes. A página Formulação de rações escala as quatro receitas informadas pelo proprietário, conforme detalhado abaixo; não realiza balanceamento nutricional. Formulações devem seguir orientação técnica e a indicação do fabricante do núcleo.
- O financeiro mostra receitas e despesas acumuladas, sem estimativas ou receitas demonstrativas.
- Histórico permite exportar e restaurar backup JSON. Restaurar substitui os registros após confirmação.

## Armazenamento e limites

Os registros ficam no localStorage deste navegador, sem login, sincronização ou servidor. Faça backups regularmente no Histórico. Limpar os dados do navegador remove os registros locais. Outra máquina ou navegador terá outro conjunto de dados.

Esta primeira versão não controla estoque físico de ovos, medicamentos, ração ou carcaças; compra de ração não equivale a consumo. Uma venda de aves abatidas reduz diretamente o plantel vivo: registre-a apenas uma vez por ave, pois não existe movimentação separada de abate. Não há edição/exclusão de lançamentos ou cadastro de lotes com idade nesta versão. O saldo inicial é aproximado e deve ser conferido antes do uso operacional.

## Formulação de rações

As receitas foram fornecidas pelo proprietário, com base padrão de 25 kg de quirera de milho ou fubá. Os percentuais são a fonte do cálculo, evitando propagar arredondamentos da tabela original:

| Receita | Milho | Soja | Trigo | Calcário calcítico | Núcleo da fase | Consumo informado |
|---|---:|---:|---:|---:|---:|---:|
| Início | 63% | 33% | — | — | 4% | 40 g/ave/dia |
| Crescimento | 62% | 20% | 14% | — | 4% | 70 g/ave/dia |
| Postura | 60% | 23% | 5% | 8% | 4% | 110 g/ave/dia |
| Engorda | 82% | 14% | — | — | 4% | 120 g/ave/dia |

Total = kg de milho / percentual de milho. A quantidade de milho e o número de aves desta fase são ajustáveis para simulação. O total é calculado sem arredondamentos intermediários e exibido com 3 casas decimais; a mistura de postura usa exatamente 25 kg de milho e resulta em 41,667 kg, em vez dos 41,670 kg arredondados da tabela enviada. A seleção da fase é manual: início de 1 a 56 dias, crescimento de 57 a 126 dias e postura a partir de 127 dias, conforme correção do proprietário. Engorda não tem faixa etária informada.

O núcleo de recria da tabela é associado ao item de compra Núcleo de crescimento, com aviso para conferir o produto. Todas as receitas usam inclusão de 4% (40 kg/t); o usuário informou que a inclusão varia por produto. A página não ajusta automaticamente essa concentração e orienta conferir rótulo e assistência técnica antes do uso.

O custo é estimado pela média ponderada histórica de compras de cada ingrediente. Sem preço de algum item, o custo total fica pendente e não é tratado como zero. Compras sem ingrediente identificado não são usadas para precificar as receitas. A simulação não modifica o plantel nem lança novas despesas, produção ou baixas de estoque.

## Guia de manejo

A página Guia de manejo reúne 10 tópicos adaptados da cartilha fornecida, com referências às páginas impressas, busca sem distinção de acentos, filtros por tema e conteúdo expansível. Inclui uma rotina diária de consulta e explica como usar os registros já disponíveis, sem simular cadastro de lotes, consumo diário, alertas sanitários ou diagnóstico. Vacinação e tratamento são apresentados como decisões a definir com assistência veterinária. Não armazena novos dados da criação nem altera os registros existentes.

## Referência

SENAR. Coleção 147 — *Avicultura: criação de frangos e poedeiras caipiras*, 2024. Planilhas das páginas 235–237 orientaram os registros de plantel e produção. As informações de manejo são referências educativas; tratamentos exigem orientação veterinária. O PDF fornecido pelo usuário não está distribuído no repositório.

## Verificação

`npm run build` valida a compilação. A validação funcional realizada com Chromium/Playwright cobre coleta, vendas de ovos e aves, despesa de ração, nascimento, mortalidade, transferência, bloqueio de saldo insuficiente, persistência após recarga, totais financeiros e layout móvel. Não modifica os dados do navegador do usuário.

## Publicação automática gratuita — Cloudflare Workers Builds

O usuário conectou o repositório `tdc160/sutrakan`, branch `main`, ao projeto Worker `sutrakan` no Cloudflare.

- Comando de build: `npm run build`.
- Comando de deploy: `npx wrangler deploy`.
- Diretório raiz: raiz do repositório.
- Configuração: `wrangler.jsonc`; arquivos estáticos: `dist`.
- Node.js: 24, definido em `.node-version`.

Mantenha a branch de produção `main` e as builds automáticas habilitadas em **Workers & Pages → sutrakan → Settings → Build**. A integração compila e publica os pushes na branch configurada. O workflow GitHub Actions verifica a build separadamente. Não envie `dist` ou `node_modules` ao GitHub. Se o deploy falhar, consulte os logs do Cloudflare; um push bem-sucedido não confirma publicação.

O endereço definitivo aparece no painel Cloudflare após o deploy. A hospedagem não adiciona banco de dados ou sincronização. Os dados do localStorage pertencem ao navegador e à origem HTTPS; mudar de endereço exige exportar e restaurar o backup. Os limites e termos do plano gratuito são os do provedor.
