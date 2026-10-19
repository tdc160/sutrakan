# Entrada de dados e acesso administrativo

## Arquitetura e alcance

O sistema usa JavaScript, Vite e Cloudflare Workers, com validação Zod compartilhada entre formulários/backup e API. O runtime é o Worker do projeto `sutrakan`; não é necessário publicar Express ou outro servidor Node separado.

O login protege a abertura normal da interface e todas as rotas administrativas da API. Registros da criação e rascunhos continuam no localStorage do aparelho. Não há banco remoto para os registros da criação nem sincronização desses dados. O endpoint de validação valida dados; ele não os salva no servidor.

Login não é criptografia de dados locais: quem tem acesso ao perfil do navegador, ferramentas de desenvolvimento ou arquivos do aparelho pode acessar o localStorage. Não afirme que o login fornece proteção criptográfica em repouso, isolamento entre vários usuários do mesmo navegador ou um banco central. Isso exige outro projeto de armazenamento e chaves. Não existe modo de “administrador” liberado por um sinalizador de localStorage: a API verifica a sessão no servidor a cada chamada.

## Ativação no Cloudflare

1. Abra **Workers & Pages → sutrakan → Settings → Variables and Secrets**.
2. Adicione **ADMIN_PASSWORD**, do tipo **Secret**, com a senha escolhida diretamente no painel. Não coloque esse valor no GitHub, no código, em variável de build, em mensagem de chat ou em arquivo público.
3. Salve/implante a alteração. O nome **ADMIN_USERNAME = Talitom** já está em `wrangler.jsonc` e não é segredo.
4. Confira o deploy da branch `main` e entre no endereço HTTPS publicado pelo Worker.

A senha nunca foi incluída no repositório. Não existe senha padrão embutida ou rota de cadastro público. Sem segredo válido, armazenamento de sessões ou rate limit, a API recusa a operação. Até configurar o segredo, o sistema fica na tela de acesso; isso é intencional, sem fallback público que burle o login.

O segredo é mantido no armazenamento de segredos criptografados do Cloudflare e acessado somente no runtime. A senha recebida é comparada por verificação HMAC do WebCrypto com chave efêmera, evitando comparação de strings com saída antecipada. O segredo é exclusivo da conta principal. Contas adicionais usam scrypt com salt individual, descrito abaixo.

## Sessões e autorização

- Tokens opacos de 256 bits aleatórios, sem dados pessoais embutidos.
- Cookie `__Host-se-admin`, com `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/` e validade absoluta de uma hora.
- Apenas o hash SHA-256 do token é usado como chave nas sessões persistentes do Durable Object `AdminSessions`.
- A sessão é consultada e sua validade é verificada em cada endpoint protegido; a conta principal deve corresponder ao administrador configurado; contas adicionais devem estar ativas e com a mesma revisão da sessão.
- Login renova o token e invalida o token anterior apresentado pelo mesmo navegador. Logout exclui a sessão no servidor, impedindo replay. Alarmes limpam sessões expiradas, que também são recusadas imediatamente na leitura.
- Dados de sessão e CSRF são enviados com `Cache-Control: no-store, private`. Não são colocados no localStorage ou no cache offline.
- O navegador exige verificação online ao abrir/recarregar o sistema. Depois de entrar, uma queda temporária permite continuar registros locais dentro da validade da sessão. Nova abertura offline fica na tela de login.
- Na expiração, o preenchimento é preservado antes de bloquear a interface. Em uma saída sem conexão, a interface é bloqueada imediatamente e a invalidação remota é concluída antes de permitir nova entrada online.

## Endpoints

| Método | Caminho | Exigências |
|---|---|---|
| POST | `/api/auth/login` | JSON estrito, origem correspondente, limites de tentativas |
| GET | `/api/auth/session` | Cookie válido e sessão ativa |
| POST | `/api/auth/logout` | Sessão, origem e `X-CSRF-Token` válido |
| POST | `/api/records/validate` | Sessão, origem, CSRF e schema estrito de registro |

Mutações exigem a origem exata da requisição e rejeitam `Sec-Fetch-Site` incompatível. O token CSRF é aleatório e vinculado à sessão, obtido por requisição do mesmo domínio. Não existe liberação CORS para origens externas. Métodos e rotas são limitados explicitamente.

## Validação e escape

`security/schemas.js` define campos permitidos, tipos exatos sem coerção, enums de tipo/categoria/ingrediente, limites de strings, datas reais não futuras, quantidades e valores finitos, e regras entre os campos. Exemplos: observações de até 500 caracteres; usuário até 64; senha entre 8 e 128; galpões de 0 a 4; núcleos somente 3%, 4% ou 5%. Para nova senha, prefira uma frase longa e única, de pelo menos 15 caracteres. Campos não declarados são rejeitados. O JIT do Zod é desativado para não exigir unsafe-eval no navegador.

A API limita o corpo a 16 KiB de bytes realmente lidos, mesmo quando Content-Length é falso. Aceita apenas JSON UTF-8, rejeita JSON malformado, parâmetros de query não previstos e headers com controles ou tamanhos excessivos (4 KiB por valor, 16 KiB no total). Backups locais têm limite de 10 MiB e schema de raiz e registros; compras antigas podem não ter ingrediente/concentração, sem atribuição automática.

Strings legítimas não têm apóstrofos, acentos ou caracteres de texto destruídos. O texto é normalizado para NFC quando processado pelo schema, controles inválidos são rejeitados e o escape é feito no contexto de saída. Templates de dados usam escape HTML ou `textContent`; a API responde JSON com `<`, `>` e `&` escapados e `nosniff`. Não renderize texto do usuário com `innerHTML` sem escape. Não existe SQL neste projeto; caso seja introduzido banco SQL, use exclusivamente comandos parametrizados. Remover aspas da entrada não substitui parâmetros SQL.

## Limites de requisições

Bindings nativos em `wrangler.jsonc`: `API_LIMITER` (60/minuto por IP), `LOGIN_LIMITER` (5/minuto por IP) e `LOGIN_ACCOUNT_LIMITER` (10/minuto por nome de usuário normalizado). Os contadores são mantidos pelo Cloudflare e não por um Map volátil do processo. O IP vem do header que a borda Cloudflare fornece; X-Forwarded-For enviado pelo cliente não é usado. Chaves de IP são hashes e não são incluídas nos logs.

O rate limiter nativo tem escopo de localização da borda, não representa um bloqueio global perfeitamente consistente. Um ataque distribuído exige controles adicionais de borda/WAF e monitoramento. A resposta de bloqueio é 429 com Retry-After. Ausência de um binding obrigatório não desativa a proteção: a operação falha com 503.

## Erros, logs e headers

Erros de entrada e autenticação têm respostas genéricas com identificador aleatório de requisição. Não retornam stack, schema interno, detalhes de armazenamento ou informações sobre a existência de outro usuário. Logs internos registram falhas inesperadas e eventos de negação/rate limit, sem senha, cookie, CSRF, corpo de requisição ou valores de query. O Cloudflare controla retenção e acesso aos logs; configure isso na conta de hospedagem.

Respostas da API recebem headers em `worker/security.js`; arquivos estáticos recebem `public/_headers`, pois o roteamento de assets pode atender sem executar o Worker. Ambos incluem CSP, X-Frame-Options, nosniff, HSTS, Referrer-Policy e Permissions-Policy. Scripts, conexões, fontes e workers são restritos à própria origem. `style-src` permite inline para os componentes/gráficos existentes; isso não libera scripts inline. Não há analytics ou fontes remotas.

## Desenvolvimento e testes

Requer Node.js 24 e npm. Use `npm ci`, `npm test`, `npm run build` e `npm run check:worker`. Para o fluxo completo, configure **localmente** um segredo de desenvolvimento em `.dev.vars` (arquivo ignorado) e execute `npm run dev:secure`. Ou use `npm run dev:secure -- --env-file /caminho/privado/arquivo.env`. Não use segredos de produção em testes. O `npm run dev` simples serve somente o frontend; ele não possui os endpoints de autenticação e não oferece bypass de login.

`.dev.vars*`, `.env*` e `.wrangler/` estão ignorados. O workflow do GitHub executa testes e build; a integração Cloudflare publica a aplicação e as migrações dos Durable Objects. Não foi confirmada a configuração de segredos nem a publicação na conta remota por este agente.

Testes automatizados cobrem limites, coerção, autenticação, expiração, revogação/replay, CSRF, origem, corpo em streaming, escape, falha fechada e logs sem credenciais. Verificações no navegador usam credenciais sintéticas locais. Isso verifica as barreiras descritas; não é certificação de conformidade integral com OWASP Top 10 nem substitui auditoria de segurança.

## Cadastro de usuários

Em **Usuários → Cadastrar usuário**, administradores informam nome, identificador, perfil e senha de 15–128 caracteres. Operadores têm as funções existentes de consulta e registro, sem API de administração de contas; essa permissão é verificada no Worker. Dados da criação continuam locais e compartilhados entre os logins no mesmo navegador. Não há isolamento de dados locais por pessoa nem sincronização entre aparelhos.

Contas adicionais persistem no Durable Object existente, em chaves `user:` separadas de `session:`. Limite de 50 contas adicionais, identificadores únicos sem distinção de maiúsculas. O administrador principal não pode ser recriado, desativado ou rebaixado, e continua recuperável pelo segredo ADMIN_PASSWORD. Administradores adicionais não alteram o próprio acesso; outro administrador pode redefinir sua senha. Não há recuperação pública por email.

Senhas adicionais usam scrypt N=16384, r=8, p=5, chave de 32 bytes e salt aleatório de 128 bits (`@noble/hashes`), perfil de memória/CPU recomendado pela OWASP. Hashes e salts nunca saem na listagem. O KDF executa dentro do Durable Object, cujo orçamento de CPU comporta o trabalho, em vez do Worker de entrada. Custo e cotas reais devem ser acompanhados no provedor. Usuários inexistentes executam o mesmo KDF; respostas não revelam se a conta existe. Nenhuma senha é guardada no frontend.

`GET /api/users` lista contas para administradores; `POST /api/users` cadastra; `POST /api/users/update` altera perfil/estado ou redefine senha. Escritas exigem sessão de administrador, origem e CSRF, schema estrito e são serializadas no Durable Object. Toda alteração incrementa a revisão e invalida as sessões anteriores no próximo pedido online. Uma tela já aberta sem rede conserva a limitação existente: registros locais podem continuar até expirar a sessão de uma hora. Não existe revogação instantânea de armazenamento offline.

Sessões anteriores do administrador principal continuam compatíveis. Não há migração destrutiva, nova binding ou novo segredo necessário para o cadastro. O service worker continua sem armazenar APIs. Testes cobrem operador sem acesso administrativo, conta principal protegida, duplicidade, redefinição, mudança de perfil e revogação.
