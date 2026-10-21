# Rotina de atualização e publicação

O usuário autorizou publicar atualizações deste sistema pelo repositório GitHub `tdc160/sutrakan`, branch de produção `main`. O Cloudflare Workers Builds está conectado a esse repositório para compilar e publicar automaticamente.

- Use o checkout existente; não crie worktrees sem solicitação do usuário.
- Preserve alterações do usuário. Antes de enviar, confira o remoto e integre alterações novas sem sobrescrever trabalho remoto.
- Execute `npm run build` e verificações funcionais proporcionais à alteração.
- Ao concluir uma atualização solicitada, faça commit dos arquivos pertinentes e push para `main`, salvo instrução contrária do usuário. Nunca use force push.
- A configuração do Worker é `wrangler.jsonc`, nome `sutrakan`, com arquivos estáticos em `dist`.
- O Cloudflare executa `npm run build` e `npx wrangler deploy`. O Worker inclui autenticação, rate limits nativos e sessões em Durable Objects. Confira SECURITY.md e MOBILE.md antes de alterar esses fluxos. Não envie `dist`, node_modules, credenciais ou dados da criação ao GitHub.
- Não afirme que o deploy terminou apenas porque o push funcionou. Confira o resultado quando houver acesso ao painel ou endpoint; caso contrário, informe que o push foi enviado e o resultado do deploy está pendente de verificação.
- Os registros são centralizados no Durable Object FARM_STORE (FarmStore), migração v2-central-farm. Preserve a chave legada santo-expedito-v1 sem sobrescrevê-la e a compatibilidade de backups. Só administradores fazem a importação inicial, uma vez. Rascunhos continuam locais; a API é a fonte de verdade para plantel e histórico. Não salve offline como se estivesse confirmado no servidor. Preserve IDs idempotentes dos rascunhos e transações de escrita.

- O proprietário exige verificação online de login antes de abrir o sistema. Não adicione bypass em desenvolvimento ou sinalizador de localStorage que libere APIs. Preserve rascunhos ao bloquear por sessão expirada.
- Nunca inclua senha no código, logs, comandos, arquivos rastreados ou instruções salvas. ADMIN_PASSWORD é um segredo do runtime Cloudflare, inserido pelo proprietário no painel. Use exclusivamente credenciais sintéticas e descartáveis nos testes locais.
- Execute `npm test`, `npm run build` e `npm run check:worker` após mudanças pertinentes. `npm run dev:secure` fornece o fluxo completo com um segredo local de desenvolvimento em `.dev.vars` (ignorado). O Vite isolado não oferece API de login.
- O service worker não deve guardar respostas de /api/ nem atualizar/recarregar formulários automaticamente. No celular, priorize resumo diário e ações grandes; mantenha análises extensas sob demanda.

- O controle de ração é opcional em `state.feed`; preserve-o em todas as gravações e backups, e mantenha compatibilidade com dados sem esse campo. Compras históricas anteriores à abertura não são saldo físico. Fórmulas compartilhadas estão em feed-model.js; ledger/mg e consumo em feed-inventory.js e worker/feed-operations.js. Não registre a produção como segunda despesa.
- Um único plano de ração por galpão acompanha `state.birds`. O cron 10 3 * * * UTC fecha o dia anterior às 00h10 de Brasília. Preserve idempotência por dia/plano, pendências sem saldo negativo, auditoria e fronteira de dias anteriores antes de mutações. Não faça baixa apenas por temporizador do navegador. Não substitua histórico fechado com datas retroativas.

- Arquitetura multi-propriedade em ARCHITECTURE.md: use property-service.js para resolver vínculo antes de acessar FarmStore. A chave legada santo-expedito nunca muda; novas propriedades usam property:<uuid>. Não autorize pelo X-Property-Id ou por estado local. A conta ADMIN_USERNAME é dona da propriedade legada, sem acesso global implícito.
- Preserve propertyId/property e feed.propertyId em todos os snapshots/backups. Rascunhos são isolados por usuário+propriedade; não volte a usar as chaves globais fora da migração legada. Respostas de um contexto anterior não podem sobrescrever o ativo. Use as taxas da propriedade para previsões e preserve taxas já fechadas.
- Cada FarmStore com alimentação ativa agenda seu próprio alarme; mantenha o cron legado como compatibilidade sem percorrer todas as propriedades. Não existe chat conectado: /api/assistant/context é somente um contexto estruturado autorizado, não um modelo de linguagem.
