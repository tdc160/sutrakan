# Chácara Santo Expedito

Sistema em português para controle da criação de galinhas caipiras. Desenvolvido com JavaScript e Vite, com login no Cloudflare Worker e registros locais no aparelho.

## Identidade visual

O sistema de design está documentado em [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), com paleta hexadecimal, tipografia local, grid de 8 px, componentes, estados, animações e comportamento responsivo. Tokens e estilos comuns estão em `design-system.css`; ícones e ilustração em `ui.js`. A referência Granvo solicitada retornou HTTP 403 no ambiente: a identidade aplicada é uma proposta própria, sem atribuir cores ou fontes não verificadas à referência. Fontes Manrope e DM Serif Display são servidas pelo próprio site; ícones Lucide. Licenças em `public/licenses`.

## Executar

Requer Node.js 24 e npm.

```sh
npm ci --cache /tmp/npm-cache
npm test
npm run build
npm run check:worker
```

Para executar a aplicação completa com autenticação, configure um segredo de desenvolvimento em `.dev.vars` (ignorado pelo Git) e execute `npm run dev:secure`. O comando inicia o runtime local Cloudflare na porta 8787. O Vite isolado (`npm run dev`) não fornece a API de login e não libera a aplicação sem autenticação. Credenciais de produção devem ser inseridas apenas nas configurações de segredo do Worker.

## Login administrativo

Usuário configurado: **Talitom**. Cadastre **ADMIN_PASSWORD** como **Secret** em Cloudflare → Workers & Pages → sutrakan → Settings → Variables and Secrets, e salve/implante. Nenhuma senha está no código. Sem esse segredo, o acesso é recusado. Login, sessão e rate limits usam o Worker e seu Durable Object; confira [SECURITY.md](SECURITY.md) para arquitetura, limites e rotas.

A abertura do sistema exige verificação online, conforme preferência do proprietário. Registros são mantidos no Durable Object FarmStore e compartilhados com os usuários autenticados. Rascunhos continuam no aparelho e não são criptografados pelo login. Uso em rede instável, leitura, navegação e proteção de rascunhos estão documentados em [MOBILE.md](MOBILE.md).

## Dashboard interativo

A Visão geral permite avaliar os registros com filtros de últimos 7, 30 ou 90 dias, mês atual, todo o histórico e intervalo personalizado. As datas são inclusivas e o dia atual usa o fuso America/Sao_Paulo.

- Indicadores: receitas, despesas, resultado e ovos coletados no período.
- Barras de receitas/despesas com séries que podem ser ocultadas pela legenda.
- Evolução de coletas de ovos, diária ou mensal conforme a extensão do período.
- Despesas por categoria ou ingrediente, separando concentrações de núcleos e preservando os itens não detalhados dos registros antigos.
- Distribuição atual do plantel, incluindo aves a distribuir. Esse saldo é sempre atual e não representa saldo histórico do período escolhido.
- Clique/toque nos gráficos ou nas listas acessíveis para ver os registros de origem. Limpar seleção restaura os registros do período. Datas também podem ser exploradas pela tabela Ver dados dos gráficos.

Dias sem lançamentos mostram zero registrado, não produção ou movimento comprovadamente nulos. Períodos sem dados exibem orientação de cadastro, sem criar dados de demonstração. O detalhamento mostra até 100 registros recentes; o Histórico conserva a lista completa. O dashboard não altera os lançamentos, receitas de ração ou saldos. Gráficos Chart.js são carregados sob demanda na análise móvel, com fontes locais, tabelas de apoio e preferência de movimento reduzido. Instâncias são encerradas ao mudar de tela ou de filtro.

## Controles

- Saldo inicial informado: aproximadamente 200 aves adultas a distribuir entre galpões e 70 pintinhos no galpão 1. Os demais três galpões começam sem aves atribuídas; não se presume sua distribuição física.
- Nascimentos, mortalidade, transferências e vendas de aves atualizam o plantel. As saídas são limitadas ao saldo disponível.
- Coletas e vendas de ovos são registradas em unidades. Uma dúzia corresponde a 12 unidades.
- Despesas de ração registram ingrediente, kg e valor total. Itens disponíveis: quirera de milho, milho em grão inteiro, núcleos de engorda/início/crescimento/postura, farelos de soja e trigo, calcário calcítico, ração pronta e outro ingrediente (detalhe em observações). Medicamentos e outros gastos registram quantidade e valor total.
- Milho em grão inteiro é um item separado da quirera usada nas receitas: suas compras entram nas despesas e no resumo por ingrediente, sem alterar o preço da quirera na formulação. Para sacos, informe o peso total em kg conforme a embalagem e anote o número de sacos nas observações; não há peso de saco presumido.
- Ao comprar um núcleo, é obrigatório informar a inclusão indicada no rótulo: 3%, 4% ou 5% (30, 40 ou 50 kg/t). A concentração fica no registro, histórico e backup; núcleos de mesma fase com concentrações distintas têm custos separados. Compras anteriores sem esse campo permanecem identificadas como concentração não informada, sem inferência automática.
- O Financeiro agrupa compras para a ração por ingrediente, com kg, gasto total e custo médio ponderado por kg (gasto dividido pelos kg comprados). Registros antigos sem ingrediente permanecem em Ração sem detalhamento; não são classificados automaticamente. Novos backups mantêm esse campo e backups anteriores continuam compatíveis.
- O Financeiro detalha as compras; os saldos físicos e as baixas ficam em Produção de ração após a abertura do estoque. A página Formulação de rações escala as quatro receitas informadas pelo proprietário, conforme detalhado abaixo; não realiza balanceamento nutricional. Formulações devem seguir orientação técnica e a indicação do fabricante do núcleo.
- O financeiro mostra receitas e despesas acumuladas, sem estimativas ou receitas demonstrativas.
- Histórico permite exportar o backup da base compartilhada e baixar a cópia legada do aparelho. A importação de backup fica disponível somente antes de iniciar a base central, para impedir substituição acidental do histórico em uso.

## Armazenamento e limites

Os registros ficam no armazenamento persistente do Cloudflare Durable Object FarmStore. Os usuários autorizados de uma propriedade consultam seu mesmo plantel, despesas, receitas e produção; outras propriedades ficam isoladas. A abertura e o salvamento exigem conexão. As telas atualizam a cada 30 segundos quando visíveis e sem formulário/menu aberto; Atualizar dados busca imediatamente. Faça backups regularmente no Histórico. Limpar o navegador remove rascunhos e cópias antigas locais, mas não os registros já confirmados no servidor.

Não há estoque físico de ovos, medicamentos ou carcaças. Ingredientes e rações produzidas têm estoque próprio após a abertura em Produção de ração; compra não equivale a consumo. Uma venda de aves abatidas reduz diretamente o plantel vivo: registre-a apenas uma vez por ave, pois não existe movimentação separada de abate. Não há edição/exclusão de lançamentos ou cadastro de lotes com idade nesta versão. O saldo inicial é aproximado e deve ser conferido antes do uso operacional.

## Formulação de rações

As receitas foram fornecidas pelo proprietário, com base padrão de 25 kg de quirera de milho ou fubá. Os percentuais são a fonte do cálculo, evitando propagar arredondamentos da tabela original:

| Receita | Milho | Soja | Trigo | Calcário calcítico | Núcleo da fase | Consumo informado |
|---|---:|---:|---:|---:|---:|---:|
| Início | 63% | 33% | — | — | 4% | 40 g/ave/dia |
| Crescimento | 62% | 20% | 14% | — | 4% | 70 g/ave/dia |
| Postura | 60% | 23% | 5% | 8% | 4% | 110 g/ave/dia |
| Engorda | 82% | 14% | — | — | 4% | 120 g/ave/dia |

Na receita-base a 4%, total = kg de milho / percentual de milho. A quantidade de milho e o número de aves desta fase são ajustáveis para simulação. O total é calculado sem arredondamentos intermediários e exibido com 3 casas decimais; a mistura de postura usa exatamente 25 kg de milho e resulta em 41,667 kg, em vez dos 41,670 kg arredondados da tabela enviada. A seleção da fase é manual: início de 1 a 56 dias, crescimento de 57 a 126 dias e postura a partir de 127 dias, conforme correção do proprietário. Engorda não tem faixa etária informada.

O núcleo de recria da tabela é associado ao item de compra Núcleo de crescimento, com aviso para conferir o produto. A calculadora permite escolher 3%, 4% ou 5% por receita. O padrão é 4%, conforme as receitas originais. A escolha de simulação permanece durante a navegação da sessão, mas não é persistida após recarregar.

Ao alterar a concentração, a quantidade de milho e as massas dos demais ingredientes da receita-base permanecem fixas na escala escolhida. Se `B` é a massa de todos os ingredientes exceto o núcleo e `c` é a porcentagem escolhida, `núcleo = B × c / (100 − c)` e `total = B / (1 − c/100)`. Os percentuais finais dos demais ingredientes são recalculados sobre esse novo total. Não se aplica simplesmente 3% ou 5% sobre um total antigo que continha núcleo a 4%.

O custo usa compras de núcleo da mesma fase e concentração; compras sem concentração não precificam automaticamente nenhum núcleo conhecido. O ajuste é matemático e não comprova equivalência nutricional de produtos a 3%, 4% e 5%. É necessário conferir o rótulo e validar com assistência técnica se a mistura com os demais ingredientes fixos é adequada.

O custo é estimado pela média ponderada histórica de compras de cada ingrediente. Sem preço de algum item, o custo total fica pendente e não é tratado como zero. Compras sem ingrediente identificado não são usadas para precificar as receitas. A simulação não modifica o plantel nem lança novas despesas, produção ou baixas de estoque.

## Guia de manejo

A página Guia de manejo reúne 10 tópicos adaptados da cartilha fornecida, com referências às páginas impressas, busca sem distinção de acentos, filtros por tema e conteúdo expansível. Inclui uma rotina diária de consulta e explica como usar os registros já disponíveis, sem simular cadastro de lotes, consumo diário, alertas sanitários ou diagnóstico. Vacinação e tratamento são apresentados como decisões a definir com assistência veterinária. Não armazena novos dados da criação nem altera os registros existentes.

## Referência

SENAR. Coleção 147 — *Avicultura: criação de frangos e poedeiras caipiras*, 2024. Planilhas das páginas 235–237 orientaram os registros de plantel e produção. As informações de manejo são referências educativas; tratamentos exigem orientação veterinária. O PDF fornecido pelo usuário não está distribuído no repositório.

## Verificação

`npm run build` valida a compilação. `npm test` verifica as quatro receitas em diferentes escalas e concentrações, o percentual sobre a massa final, a preservação dos demais ingredientes e a separação dos preços históricos por fase e concentração. A validação funcional realizada com Chromium/Playwright cobre coleta, vendas de ovos e aves, despesa de ração, nascimento, mortalidade, transferência, bloqueio de saldo insuficiente, persistência após recarga, totais financeiros e layout móvel. Não modifica os dados do navegador do usuário.

## Publicação automática gratuita — Cloudflare Workers Builds

O deploy agora inclui API, sessões persistentes em Durable Objects e rate limits nativos, definidos em `wrangler.jsonc`. A integração de produção requer o segredo ADMIN_PASSWORD no runtime.

O usuário conectou o repositório `tdc160/sutrakan`, branch `main`, ao projeto Worker `sutrakan` no Cloudflare.

- Comando de build: `npm run build`.
- Comando de deploy: `npx wrangler deploy`.
- Diretório raiz: raiz do repositório.
- Configuração: `wrangler.jsonc`; arquivos estáticos: `dist`.
- Node.js: 24, definido em `.node-version`.

Mantenha a branch de produção `main` e as builds automáticas habilitadas em **Workers & Pages → sutrakan → Settings → Build**. A integração compila e publica os pushes na branch configurada. O workflow GitHub Actions verifica a build separadamente. Não envie `dist` ou `node_modules` ao GitHub. Se o deploy falhar, consulte os logs do Cloudflare; um push bem-sucedido não confirma publicação.

O endereço definitivo aparece no painel Cloudflare após o deploy. A configuração publica a migração v2-central-farm e a binding FARM_STORE automaticamente. Não é necessário criar um banco manualmente. A migração dos dados antigos ocorre no primeiro acesso do administrador. Os limites e termos do plano gratuito são os do provedor.

### Usuários

Entre como Talitom e abra **Usuários** (no celular, **Menu → Usuários**). Em **Cadastrar usuário**, preencha nome, usuário, perfil e senha com pelo menos 15 caracteres. Administradores também podem desativar/reativar contas, alterar perfil e redefinir senhas. Cada atualização encerra as sessões anteriores dessa pessoa nos próximos acessos online. A conta Talitom é protegida e mantém a senha configurada no Cloudflare. Contas persistem no servidor; os registros são compartilhados entre os aparelhos autorizados da mesma propriedade.

### Primeira importação central

Após o deploy, entre como Talitom **no aparelho onde está o histórico completo**. Confira as quantidades e escolha **Importar os dados deste aparelho**, ou importe um backup JSON válido. A chave antiga `santo-expedito-v1` permanece intacta e pode ser baixada. O plantel atual é importado diretamente, sem reaplicar nascimentos/vendas antigos. Apenas um administrador pode iniciar a base; um segundo aparelho recebe conflito e precisa atualizar, sem sobrescrever os dados.

Se não houver histórico, **Iniciar sem histórico (270 aves)** cria o ponto inicial configurado. Essa ação também exige confirmação. Se houver históricos diferentes em outros aparelhos, guarde os backups antes: não há fusão automática, pois poderia duplicar vendas e movimentações.

Sem conexão é possível consultar a tela já aberta e preencher um rascunho. O botão Salvar só confirma após a escrita no servidor. Ao reconectar, revise e salve. O identificador acompanha o rascunho para permitir repetir uma tentativa cuja resposta se perdeu, sem duplicar o registro. Novos registros recebem autor e horário do servidor. Não existe fila automática de envios offline.

### Atalhos no computador e no celular

A tela de login, o rodapé e o Menu do celular oferecem **Atalho no computador** e **Atalho no celular**. Quando o navegador oferece instalação PWA, o usuário pode confirmar pelo diálogo. No Windows também é possível baixar `Santo Expedito.url` e mover o arquivo de Downloads para a Área de Trabalho. No iPhone/iPad, o diálogo orienta Safari → Compartilhar → Adicionar à Tela de Início. Android orienta o menu do Chrome. Navegadores sem instalação recebem instruções e endereço copiável, sem prometer criação automática de atalhos. A instalação mantém o login online e a base compartilhada.

## Produção e consumo de ração

Acesse **Produção de ração** (no celular, Menu). O fluxo é:

1. Um administrador informa o estoque físico atual de cada ingrediente/concentração e de cada uma das quatro rações prontas. Compras anteriores continuam no Financeiro, mas **não são somadas novamente**. A posição no histórico é guardada para que somente compras registradas depois da abertura entrem no saldo.
2. Em **Produzir ração**, escolha Início, Crescimento, Postura ou Engorda, a base de quirera (padrão 25 kg) e o núcleo de 3%, 4% ou 5%. Confira a prévia. Ao confirmar, ingredientes saem e o total calculado entra na ração selecionada, na mesma transação. Não é registrada outra despesa financeira.
3. Em **Alimentação por galpão**, um administrador escolhe a ração de cada galpão. Cada galpão usa uma única ração, conforme informado pelo proprietário. Aves ainda sem distribuição podem ser associadas pela opção A distribuir. Não há escolha automática pela idade, pois os lotes ainda não têm nascimento cadastrado individualmente.

O Cloudflare Cron configurado em `wrangler.jsonc` (`10 3 * * *`, UTC) executa às **00h10 de Brasília**, fecha o dia anterior e baixa `aves do galpão × g/ave/dia ÷ 1000`: Início 40 g; Crescimento 70 g; Postura 110 g; Engorda 120 g. A configuração começa no dia em que for salva, sem retroagir ao histórico. Usa o plantel registrado ao encerramento, e não uma média por hora nem medição do alimento efetivamente ingerido. Nascimentos/saídas alteram a quantidade usada nos próximos fechamentos. Lançamentos retroativos não refazem dias fechados.

O botão **Conferir baixas até ontem** permite conciliar manualmente se um agendamento atrasar. A conciliação também ocorre antes das novas mutações do plantel/ração para preservar o retrato do dia anterior. Repetir o job não duplica a baixa. Falta de ração gera pendência sem saldo negativo; ao produzir ou adicionar saldo, as pendências são atendidas por data, com prioridade das mais antigas da mesma ração. A tela inicial mostra um aviso de pendências. A recuperação de uma interrupção longa avança em blocos de até 31 dias por passagem, sem descartar datas.

Núcleos da mesma fase com concentrações diferentes têm saldos separados. Milho em grão inteiro não substitui a quirera da fórmula; seu fornecimento avulso pode ser registrado como ajuste negativo de ingrediente. Ração pronta comprada sem fase fica sem associação às quatro rações produzidas. Ajustes de ingrediente ou ração exigem administrador e motivo, não podem deixar saldo negativo e não geram receita/despesa. Perdas e diferenças do peso efetivo da mistura podem ser ajustadas com motivo.

Os históricos de produção, ajustes e baixas ficam na página; o backup da base inclui o conteúdo completo. Massas são contabilizadas em miligramas inteiros e exibidas em kg com até três casas, conservando o total da mistura. Não houve alteração das proporções da formulação fornecida nem validação nutricional adicional. Rascunhos de produção são guardados no aparelho, mas a confirmação depende da gravação online.

## Propriedades personalizáveis

A plataforma agora separa as propriedades por ID e verifica o vínculo do usuário em cada API. Consulte [ARCHITECTURE.md](ARCHITECTURE.md) para o modelo, a migração e os limites.

- No login, **Cadastrar minha propriedade** cria uma conta e uma propriedade independente, com seu próprio plantel inicial (padrão zero).
- Após entrar, o seletor **Propriedade ativa** alterna apenas entre as propriedades autorizadas.
- Em **Gerenciar propriedades**, personalize nome, proprietário, região, hectares, produção principal e gramas por ave/dia; ou cadastre outra propriedade da sua conta.
- Registros, usuários autorizados, estoque, baixas, backups e rascunhos ficam no contexto selecionado. Alterar o nome não muda o ID ou o histórico.
- A Santo Expedito mantém seus dados e contas no objeto original. Não é necessário reimportar uma base já centralizada ou cadastrar novamente os usuários existentes.

Não havia chat no código. A API `/api/assistant/context` prepara o contexto autorizado para uma futura integração, sem chamar serviço externo de IA. Os módulos atuais continuam voltados à avicultura; o tipo de produção cadastral não converte automaticamente as fórmulas para outras espécies.
