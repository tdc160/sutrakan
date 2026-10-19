# Rotina de atualização e publicação

O usuário autorizou publicar atualizações deste sistema pelo repositório GitHub `tdc160/sutrakan`, branch de produção `main`. O Cloudflare Workers Builds está conectado a esse repositório para compilar e publicar automaticamente.

- Use o checkout existente; não crie worktrees sem solicitação do usuário.
- Preserve alterações do usuário. Antes de enviar, confira o remoto e integre alterações novas sem sobrescrever trabalho remoto.
- Execute `npm run build` e verificações funcionais proporcionais à alteração.
- Ao concluir uma atualização solicitada, faça commit dos arquivos pertinentes e push para `main`, salvo instrução contrária do usuário. Nunca use force push.
- A configuração do Worker é `wrangler.jsonc`, nome `sutrakan`, com arquivos estáticos em `dist`.
- O Cloudflare executa `npm run build` e `npx wrangler deploy`. Não envie `dist`, node_modules, credenciais ou dados da criação ao GitHub.
- Não afirme que o deploy terminou apenas porque o push funcionou. Confira o resultado quando houver acesso ao painel ou endpoint; caso contrário, informe que o push foi enviado e o resultado do deploy está pendente de verificação.
- Os dados são locais ao navegador e à origem HTTPS. Preserve a chave de armazenamento e a compatibilidade de dados; mudanças exigem migração. Hospedagem não fornece sincronização ou backup automático.
