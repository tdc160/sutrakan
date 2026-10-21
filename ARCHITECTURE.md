# Propriedades, identidade e contexto

A reestruturação começa pela fronteira de dados: uma propriedade tem identidade estável, usuários autorizados e um armazenamento próprio. Personalizar apenas os títulos ou aplicar um filtro no navegador não isola uma fazenda.

## Modelo

- `Property`: `id`, `name`, `owner` (nome cadastral), `region`, `hectares`, `productionType`, `feedingRates` (g por ave/dia nas quatro fases).
- Identidade global: usuário único, senha com scrypt, estado da conta e revisão de sessão.
- Vínculo usuário–propriedade: `role` e `active`. Ser administrador de uma propriedade não dá acesso a outra.
- Domínio da propriedade: plantel, registros com `propertyId`, estoque de ração com `propertyId`, planos, produções, ajustes, baixas e recibos. Eventos do estoque pertencem ao agregado identificado, sem compartilhar coleções entre propriedades.

O nome cadastral do proprietário não transfere a titularidade do acesso. `ownerUsername`, no diretório de autorização, identifica a conta proprietária protegida.

## Organização do código

| Responsabilidade | Arquivo |
| --- | --- |
| Tipos, limites e validação dos cadastros | `security/property-schemas.js` |
| Padrões de domínio e contexto estruturado do assistente | `property-model.js` |
| Diretório e vínculos persistentes | `worker/property-registry.js` |
| Resolução de acesso e seleção do armazenamento | `worker/property-service.js` |
| Dados, transações, perfil e alarmes de uma propriedade | `worker/farm.js` |
| Sessão e escolha autorizada da propriedade | `auth.js`, `property-context.js` |
| Formulários reutilizados no cadastro e na personalização | `property-forms.js`, `properties.js` |

## Requisição de domínio

1. Verificar a sessão no servidor.
2. Interpretar `X-Property-Id` como um seletor, nunca como autorização.
3. Resolver o vínculo ativo e sua permissão no diretório.
4. Escolher o Durable Object daquela propriedade e confirmar internamente o ID vinculado.
5. Validar o comando e executar a transação no armazenamento isolado.

`/api/farm`, usuários, validação de registros e `/api/assistant/context` seguem essa fronteira. Cadastro/listagem das propriedades usa a identidade autenticada. Somente o administrador geral provisiona uma propriedade e seu administrador local; `/api/auth/register` retorna 403.

## Preservação da Santo Expedito

O ID e o nome interno do objeto legado continuam **`santo-expedito`**. Novos objetos usam `property:<uuid>`. Não há cópia para outro objeto, substituição do histórico ou mudança das proporções das rações.

A vinculação legada é feita de forma idempotente: as contas existentes antes da alteração recebem apenas o vínculo da Santo Expedito, com os perfis anteriores. Contas criadas pelo novo cadastro têm marcador próprio e nunca entram nessa migração. A conta do segredo ADMIN_PASSWORD é proprietária da Santo Expedito e administradora geral da plataforma.

O vínculo do objeto e o perfil ficam em metadados persistentes. Snapshots antigos continuam legíveis; registros e estoque recebem o ID ao serem lidos e o mantêm nas próximas escritas/exports. Recibos idempotentes anteriores permanecem válidos. Backups identificados com outra propriedade são recusados. Backups antigos sem ID só podem inicializar a base legada; não viram dados de uma conta nova.

## Cálculos e rotina diária

Cada propriedade define seus valores de consumo (padrões: 40/70/110/120 g). A previsão, a calculadora e os fechamentos usam os parâmetros ativos. Antes de alterar taxas, o objeto fecha os dias anteriores com os parâmetros antigos. Cada baixa mantém sua quantidade, taxa e fase registradas; alterações posteriores não reescrevem esse histórico.

As proporções avícolas das quatro fórmulas continuam como modelos de referência. Área, região e um texto de produção principal não geram recomendações nutricionais automáticas nem habilitam módulos para outras espécies. O calendário operacional continua em America/Sao_Paulo.

Cada objeto com plano ativo agenda seu próprio alarme persistente para 00h10 de Brasília. Não é necessário percorrer todas as propriedades em um único cron. O cron já existente continua como mecanismo de compatibilidade da Santo Expedito. Alarmes e cron compartilham a conciliação idempotente por dia/plano.

## Contexto no navegador

O seletor mostra somente propriedades autorizadas. A troca preserva o preenchimento, limpa a visualização anterior e busca os dados novos. Respostas de um contexto anterior são descartadas, mesmo se chegarem depois da troca. Backups exportados identificam a propriedade.

Rascunhos usam chaves por usuário+propriedade, inclusive suas cópias em memória. A leitura de rascunhos globais antigos fica limitada ao contexto legado autorizado, sem apagar o original. Isso protege o fluxo da aplicação, mas não criptografa o perfil do navegador contra quem tem acesso físico ou ferramentas de desenvolvimento.

## Assistente e próximos passos

Não havia chat, conversas salvas ou integração com modelo de linguagem no projeto. `GET /api/assistant/context` agora entrega apenas o perfil, plantel, taxas e contagens da propriedade autorizada. Não envia dados a um provedor de IA nem simula respostas de um modelo.

Uma futura integração deve resolver a autorização pelo mesmo serviço, carregar dados somente do objeto ativo e armazenar conversas/mensagens com a identidade da propriedade. O ID informado pelo cliente ou por um modelo nunca substitui a verificação do vínculo.

O domínio distribui armazenamento e processamento por propriedade, mas o diretório de identidade ainda é um único Durable Object. Há limite de 50 vínculos por propriedade (incluindo proprietário); os limites do snapshot/estoque são por propriedade. Para operação SaaS em grande escala, evoluir identidade/recuperação de contas, índices, observabilidade e persistência paginada. Não há recuperação pública de senha por email nem convites a contas já existentes nesta etapa. Administradores não podem redefinir a senha global de uma identidade vinculada a várias propriedades.

## Administração geral e provisionamento restrito

A identidade de bootstrap `ADMIN_USERNAME` é o administrador geral. O servidor confirma o nome canônico e a sessão de bootstrap; o campo `generalAdministrator` na resposta serve apenas à apresentação. Esse administrador lista e acessa as propriedades, e é o único autorizado a fazer POST `/api/properties`. O cadastro exige `administrator` (username, name e password de 8–128 caracteres), criando atomicamente identidade, propriedade e vínculo administrativo exclusivo. Nomes de usuário já existentes não são reaproveitados nem têm suas senhas sobrescritas. Senhas são derivadas no Durable Object e nunca fazem parte da definição da propriedade.

POST `/api/auth/register` está desativado (403) e não há cadastro público na tela de login. Administradores locais mantêm as ferramentas e a gestão de usuários de sua propriedade; o papel `admin` local nunca concede provisionamento ou administração geral. Tentativas por API recebem 403 antes de criar dados. Dados e vínculos anteriores são preservados; esta alteração não transfere nem apaga propriedades existentes.

## Exclusão de propriedades

Somente o administrador geral pode fazer POST `/api/properties/delete`, com origem válida, sessão, CSRF e confirmação do ID. A interface exige digitar o nome antes de enviar. O diretório revoga vínculos primeiro e desativa identidades que ficaram sem vínculos ativos, invalidando suas sessões por revisão. O FarmStore apaga os chunks, perfil e metadados em transação, cancela seu alarme e mantém apenas um marcador de exclusão. Requisições antigas e alarmes não recriam a base. O cron legado aceita 410 para a propriedade excluída.

Se a limpeza for interrompida, a propriedade permanece bloqueada, aparece como exclusão pendente somente para o administrador geral e pode ser excluída novamente para concluir. Após a limpeza, o diretório guarda apenas o ID, autor e datas de exclusão, impedindo reutilização acidental do ID. As outras propriedades e identidades compartilhadas mantêm seus acessos. Backups e rascunhos existentes nos aparelhos não são apagados remotamente. Não há restauração automática dos registros apagados.
