# Uso no campo

## Leitura e toque

A versão de até 700 px tem fundo sólido, contraste maior e texto principal de 16 px, com legendas de 14–15 px. Ações principais medem 56–64 px e têm separação de 12 px. A barra inferior oferece Início, Ovos, Registrar e Menu, sem depender de rolagem horizontal para encontrar telas. Menu reúne os demais destinos em linhas grandes.

A tela inicial prioriza ovos de hoje, vendas, gastos e plantel atual, com atalhos de coleta, venda e despesa. Os gráficos ficam em “Abrir dashboard completo” e o código da análise é carregado sob demanda; isso reduz o JavaScript necessário antes da interação principal. Tabelas viram cartões com rótulos no celular, evitando leitura de colunas fora da tela. Os dados e recursos de desktop continuam disponíveis.

## Formulários

Os atalhos já escolhem o tipo de registro. Quantidades e dinheiro pedem teclado numérico/decimal, data começa em hoje e observações ficam em seção opcional. Origem de saídas precisa ser escolhida explicitamente para evitar retirar aves do galpão errado. Venda de ovos não pede origem. Núcleos pedem concentração, e outros ingredientes não mantêm esse campo.

O rascunho é salvo em uma chave separada (`santo-expedito-record-draft-v1`) a cada entrada, sem virar um lançamento. Cada tipo de registro guarda seus campos separadamente quando se troca o tipo. “Guardar e fechar” preserva; “Descartar rascunho” exige confirmação e não apaga registros. Salvar um registro com sucesso limpa o rascunho somente após a confirmação da escrita central no servidor. Erros mantêm o formulário e reabilitam a ação. Pedidos de login têm prazo de 12 segundos, com mensagem de conexão e nova tentativa sem apagar os campos. Dados salvos ilegíveis ou inválidos não são substituídos por um plantel vazio: a inicialização central permite baixar a cópia original e importar um backup validado; a cópia ilegível nunca é substituída.

No celular o formulário ocupa a tela, acompanha a altura visível e deixa Salvar no rodapé aderente. Se o armazenamento falhar, o formulário avisa e não fecha como se o rascunho estivesse salvo. Uma cópia de memória ajuda a retomar na mesma página; falta de espaço ou bloqueio do armazenamento impede garantia de recuperação após fechar o navegador. Não ignore esse aviso.

## Conexão, sessão e atualização

A escolha do proprietário é exigir verificação **online** para abrir o sistema. Portanto, mesmo preparado para quedas de sinal, uma nova abertura/reload sem conexão fica no login. A sessão tem validade de uma hora e é verificada no servidor ao abrir; consulte SECURITY.md.

Após entrar, a tela já aberta pode ser consultada e formulários podem virar rascunhos durante uma perda temporária de sinal enquanto a sessão está válida. Salvar exige conexão e confirmação do servidor; não há envio automático ao reconectar. O service worker prepara arquivos e fontes do próprio domínio e tenta recuperar a preparação quando a conexão retorna. O indicador só afirma preparação após a ativação. Nenhuma API de sessão, senha ou dado administrativo é colocada no cache offline.

O novo aplicativo pede uma ação explícita para atualizar; não recarrega um formulário automaticamente. Um rascunho existente é informado antes de aceitar a atualização e pode ser retomado depois de entrar novamente. O cache de arquivos não é backup dos dados: continue exportando pelo Histórico. Os registros são centralizados no servidor; Atualizar dados busca alterações da equipe, além da verificação periódica a cada 30 segundos quando a tela está visível e sem formulário aberto. O polling não fecha formulários nem substitui campos em edição.

## Verificações

Testes em Chromium móvel verificam navegação por polegar, telas de 360/390 px, formulário com viewport reduzido a 440 px, rascunho por tipo, interrupção/reload, falha de armazenamento e preservação de registros. Testes de produção verificam service worker real, cache HTTP limpo, acesso sem rede, atualização sob demanda e autenticação no runtime Cloudflare local. Testes de bancada não substituem avaliação física sob sol nem a conferência em Safari/iPhone e outros aparelhos de uso real.

O UUID do lançamento acompanha o rascunho antes de qualquer envio. Se o servidor salvar e a resposta se perder, reenviar o mesmo rascunho (mesmo após recarregar) confirma o registro existente sem duplicar. O plantel é conferido no servidor, inclusive contra movimentações simultâneas de outro aparelho. Conflitos mantêm o formulário: guarde, atualize a base e confira os dados. A cópia antiga do aparelho é preservada para a primeira importação administrativa.

O botão Atualizar aplicativo também aparece antes do login quando há uma versão aguardando. A navegação pública `/api/app/update` entrega o HTML atual com no-store fora do fallback de navegação do service worker antigo. Ela não apaga caches, registros ou rascunhos e não dispensa autenticação para os dados. Após carregar, a URL volta para `/`. A atualização continua explícita, com confirmação se houver rascunho.

## Acesso por atalho

`shortcuts.js` oferece opções antes e depois do login, inclusive no Menu. `beforeinstallprompt` é guardado somente em memória e consumido uma vez, dentro de um clique do usuário. Cancelamento, ausência de suporte e falhas recebem orientação manual. `appinstalled`/display-mode standalone atualizam o estado. iOS usa instruções específicas do Safari, incluindo iPads com identificação de desktop. O download Windows contém somente o endereço raiz HTTPS atual, sem sessão, senha ou token. Copiar endereço tem alternativa de seleção manual se clipboard for negado. Diálogos têm título, fechamento por Escape, retorno de foco e alvos de 56 px. O diálogo do menu é fechado antes de abrir as instruções.

Ícones PNG 192/512 e apple-touch-icon 180 complementam o SVG; manifest e ícones entram no cache de arquivos estáticos. Nenhuma API entra no cache e o login não muda. Verificações em Chromium/emulação móvel cobrem download, texto do arquivo, instalação simulada aceita, uso único do evento, estado instalado, alternativa sem clipboard e instruções Android/iOS. A confirmação nativa e a criação final no sistema operacional dependem do navegador/aparelho real.

## Produção de ração

Menu → Produção de ração apresenta quatro saldos, prévia dos ingredientes necessários, plano por galpão e históricos expansíveis. Campos numéricos usam teclado decimal e ações de pelo menos 56 px. Compras são feitas pelo formulário de Despesa → Ração já existente. O botão Conferir baixas até ontem não lança o consumo de hoje antes de encerrar o dia.

Os formulários de abertura, produção, alimentação e ajuste têm rascunhos individuais, UUID estável e opção explícita de descarte. A página evita polling que substitua os campos durante a edição; Atualizar dados busca o estado novo preservando o preenchimento. Salvar bloqueia os controles até a confirmação e mantém os dados em falhas de rede, quota ou sessão. A cópia de memória permite retomar após navegar ou entrar novamente na mesma página; não substitui o armazenamento após fechar o navegador. Sem conexão não há envio automático nem promessa de saldo já alterado.

Verificações em Chromium móvel/runtime local cobrem abertura dos saldos, produção com 3%, plano dos 70 pintinhos, compras posteriores, exportação com estoque, rascunho offline, resposta perdida seguida de reload sem duplicar, quota com recuperação após logout/login e larguras 360/390/768/1280. O cron é executado no servidor e não depende do aparelho continuar aberto.
