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
- Despesas de ração registram kg e valor total; medicamentos e outros gastos registram quantidade e valor total.
- O financeiro mostra receitas e despesas acumuladas, sem estimativas ou receitas demonstrativas.
- Histórico permite exportar e restaurar backup JSON. Restaurar substitui os registros após confirmação.

## Armazenamento e limites

Os registros ficam no localStorage deste navegador, sem login, sincronização ou servidor. Faça backups regularmente no Histórico. Limpar os dados do navegador remove os registros locais. Outra máquina ou navegador terá outro conjunto de dados.

Esta primeira versão não controla estoque físico de ovos, medicamentos, ração ou carcaças; compra de ração não equivale a consumo. Uma venda de aves abatidas reduz diretamente o plantel vivo: registre-a apenas uma vez por ave, pois não existe movimentação separada de abate. Não há edição/exclusão de lançamentos ou cadastro de lotes com idade nesta versão. O saldo inicial é aproximado e deve ser conferido antes do uso operacional.

## Referência

SENAR. Coleção 147 — *Avicultura: criação de frangos e poedeiras caipiras*, 2024. Planilhas das páginas 235–237 orientaram os registros de plantel e produção. As informações de manejo são referências educativas; tratamentos exigem orientação veterinária. O PDF fornecido pelo usuário não está distribuído no repositório.

## Verificação

`npm run build` valida a compilação. A validação funcional realizada com Chromium/Playwright cobre coleta, vendas de ovos e aves, despesa de ração, nascimento, mortalidade, transferência, bloqueio de saldo insuficiente, persistência após recarga, totais financeiros e layout móvel. Não modifica os dados do navegador do usuário.

## Publicação automática gratuita — Cloudflare Pages

O repositório de origem é `tdc160/sutrakan`, branch de produção `main`.

1. Entre na sua conta Cloudflare e abra **Workers & Pages**.
2. Crie um projeto **Pages**, escolhendo importar/conectar um repositório Git existente.
3. Autorize a integração GitHub para `tdc160/sutrakan` e selecione esse repositório.
4. Configure:
   - Nome do projeto: `santo-expedito` (ou outro disponível).
   - Branch de produção: `main`.
   - Framework: Vite (ou sem framework, com os comandos abaixo).
   - Comando de build: `npm run build`.
   - Diretório de saída: `dist`.
   - Diretório raiz: raiz do repositório.
   - Versão do Node: 24, definida em `.node-version`.
5. Salve e faça o primeiro deploy. O painel informará o endereço HTTPS em `pages.dev`.

A integração instala as dependências e faz a build a cada push em `main`. Não envie `dist` ou `node_modules` ao GitHub. O workflow GitHub Actions também verifica a build, mas o deploy é feito pela integração Cloudflare Pages. Uma build que falha não substitui o último deploy bem-sucedido.

A hospedagem entrega somente os arquivos do aplicativo. Ela não adiciona banco de dados, autenticação ou sincronização. Mantenha o endereço definitivo: dados do localStorage pertencem ao navegador e à origem HTTPS; mudar de endereço exige exportar e restaurar o backup. Os limites e termos do plano gratuito são os do provedor.
