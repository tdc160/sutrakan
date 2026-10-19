# Santo Expedito — sistema de design

Versão 1.0 · 19/10/2026

## Origem e direção visual

A referência solicitada foi https://www.granvo.com.br/. O ambiente recebeu HTTP 403 do proxy nas duas tentativas de acesso, portanto não foi possível inspecionar seu HTML, CSS, fontes ou aparência. Este documento descreve uma proposta original aplicada à Santo Expedito; os valores abaixo não devem ser atribuídos à Granvo.

A direção combina verde profundo, superfícies claras, acento vegetal e títulos serifados. A identidade busca comunicar cuidado com a propriedade, clareza de registros e proximidade com a vida no campo. O painel permanece uma ferramenta de gestão: mantém hierarquia de informações e ações previsíveis.

## Cores

Tokens definidos em `design-system.css`. Use os tokens em novas telas.

| Token | Hex | Aplicação |
|---|---|---|
| `--color-forest` | `#163F2D` | Navegação, títulos de valores, botão principal e banners |
| `--color-forest-hover` | `#24583F` | Hover do botão principal |
| `--color-lime` | `#D7EEA2` | Navegação ativa, botão sobre banner escuro e detalhes gráficos |
| `--color-lime-hover` | `#C9E58B` | Hover de ação em lima |
| `--color-canvas` | `#F6F7F2` | Fundo geral |
| `--color-surface` | `#FFFFFF` | Cards, campos e tabelas |
| `--color-text` | `#203A2B` | Texto principal |
| `--color-muted` | `#667266` | Texto de apoio sobre fundo claro |
| `--color-border` | `#DFE5D8` | Separadores e contornos de cards |
| `--color-soft` | `#EDF2E5` | Apoio, seleção secundária e cabeçalhos de tabela |
| `--color-warning` | `#855820` | Categoria ovos e avisos contextuais |
| `--color-warning-soft` | `#FAF0DA` | Fundo da categoria de aviso |
| `--color-danger` | `#A3442C` | Despesas e mensagens de erro |
| `--color-danger-soft` | `#FAEEE7` | Fundo da categoria de despesa |
| `--color-focus` | `#63823C` | Contorno de foco por teclado |

Pares previstos: texto `#203A2B` ou apoio `#667266` em branco/fundo geral; branco sobre `#163F2D`; texto `#163F2D` sobre lima. Não use branco sobre lima nem lima para pequenos textos em fundo branco. Estado e categoria devem usar também texto, ícone ou `aria-pressed`, sem depender apenas da cor. Bordas suaves de cards são decorativas; campos usam contorno mais definido `#C9D3BD` e foco explícito.

## Tipografia

Fontes incluídas no build com Fontsource; nenhuma requisição ao Google Fonts é necessária. Subconjunto latino inclui acentos do português. Manrope usa pesos reais 400, 500, 600 e 700; DM Serif Display usa 400. Fallbacks: sans-serif para corpo e Georgia/serif para títulos.

| Papel | Fonte | Tamanho desktop / celular | Peso | Entrelinha |
|---|---|---|---|---|
| Título de página | DM Serif Display | 38 / 32 px | 400 | 1,2 |
| Título de banner | DM Serif Display | 34 / 30 px | 400 | 1,2 |
| Título de seção | Manrope | 16 / 14 px | 700 | 1,5 |
| Valor de indicador | Manrope | 29 / 25 px | 700 | 1,2 |
| Corpo principal | Manrope | 14 / 12–14 px | 400 | 1,6–1,9 |
| Rótulo / botão | Manrope | 12 px | 600–700 | 1,5–1,8 |
| Texto auxiliar / tabela | Manrope | 11–12 px | 400–600 | 1,6–1,8 |
| Sobretítulo | Manrope | 10 / 9 px | 700 | 1,5 |
| Campo de formulário | Manrope | 13 / 16 px | 400 | herdada |

Os 16 px nos campos móveis ajudam a evitar zoom automático ao digitar. Textos de 9–10 px ficam restritos a legendas curtas e navegação compacta. Valores financeiros e tabelas usam números tabulares. Títulos têm espaçamento de letras de até −1 px; sobretítulos usam até 1,8 px. Não aplique serifas em textos longos ou números de tabelas.

## Espaçamento e grid

Base de 8 px, com meio passo de 4 px para detalhes. Escala: `4, 8, 12, 16, 24, 32, 40, 48, 64 px`, exposta como `--space-1` a `--space-9`.

- Desktop: navegação de 256 px (232 px até 1200 px), cabeçalho de 80 px, conteúdo com largura máxima de 1536 px incluindo preenchimento, margens internas de 40 px e separação de 24–32 px entre seções.
- Indicadores: quatro colunas com gap de 16 px. Cards têm padding de 24 px e raio de 16 px.
- Conteúdo: grade de duas colunas para plantel e financeiro; tabelas ocupam a largura da seção.
- 701–1000 px: navegação em trilho de 80 px; indicadores em duas colunas; área principal com padding de 24 px.
- Até 700 px: navegação inferior de quatro ações (Início, Ovos, Registrar, Menu), com destinos adicionais no menu; conteúdo sem margem lateral de navegação, padding de 16 px e reserva inferior para a barra e área segura. A área segura do dispositivo é respeitada.
- Celular: indicadores e receitas em duas colunas; listas extensas, rotina e calculadora em uma coluna. Tabelas largas rolam dentro do card, sem alargar a página.

Os raios (8, 12, 16 e 24 px), bordas (1 px) e ícones (16, 20, 24 px) são escalas de componente, não regras de distância entre blocos.

## Botões e estados

| Variante | Aparência | Dimensões e comportamento |
|---|---|---|
| Principal | Fundo floresta, texto branco, peso 700 | Altura mínima 48 px; padding 12 × 20 px; raio 12 px; ícone 18 px com gap 8 px |
| Ação no banner | Fundo lima, texto floresta | Formato pill, altura mínima 40 px, padding 8 × 16 px |
| Secundário / texto | Texto floresta; fundo suave no hover | Altura 40–44 px; raio 8 px |
| Filtro | Contorno suave; ativo em floresta com texto branco | Pill, altura 44 px (40 px no celular); `aria-pressed` |
| Receita selecionável | Card branco; ativo com fundo suave e borda verde | Padding 24 × 16 px; raio 16 px; `aria-pressed` |
| Navegação | Texto claro sobre floresta; seleção em lima | Área de 48 px no desktop; no celular ícone e rótulo sobre superfície clara |

Hover altera cor e contorno; ações de clique têm deslocamento de 1 px. Desabilitado reduz opacidade a 50% e muda o cursor, sem substituir o atributo `disabled`. Foco de teclado: anel de 3 px em `#63823C`, separado 4 px do botão. Campos usam foco com borda verde e halo de 3 px. Erros usam texto próximo ao formulário com `role="alert"`; nenhuma mensagem deve depender só de cor.

## Cards, tabelas e formulários

Cards: superfície branca, contorno de 1 px, raio de 16 px, sombra `0 4px 24px rgb(22 63 45 / 3%)`. Banners: floresta, raio de 24 px e ilustração decorativa original da propriedade em SVG. Modais: raio de 24 px, sombra `0 24px 80px rgb(22 63 45 / 20%)`, fundo da página escurecido a 55%, altura limitada com rolagem interna.

Tabelas: cabeçalho com fundo suave, alinhamento previsível, dados em corpo de 12 px e padding de 16 px; no celular, 11 px e padding de 12 px. Hover de linha é apenas apoio visual. Campos: altura mínima de 48 px, borda definida, rótulo visível, placeholders auxiliares; não substitua rótulos por placeholders. Campos quantitativos e financeiros preservam as validações existentes.

## Ícones e imagens

Lucide, traço 1,7 px, sem preenchimento, tamanhos de 16 a 24 px; gráficos de banner podem usar tamanho maior. Os ícones são decorativos quando acompanhados por rótulos (`aria-hidden`). Destinos de navegação têm nomes acessíveis, `title` e indicação `aria-current="page"`. A marca usa um broto; plantel usa ave; produção usa ovo; ração usa trigo. Não usar glifos Unicode como substitutos de ícones principais. A paisagem SVG do painel é uma ilustração original e decorativa, sem fotos ou marcas copiadas da referência.

## Movimento

- Feedback de hover/foco: 160 ms para cor, borda, sombra e transformação.
- Abertura de modal: 240 ms com opacidade de 0 a 1, deslocamento de 12 px e escala de 0,98 a 1.
- Receita no hover: elevação de 2 px; nunca altera o conteúdo ou os números.
- Curva de entrada: `cubic-bezier(.2,.8,.2,1)`.
- Sem carrossel automático, parallax, animação contínua de valores ou conteúdo piscante.
- `prefers-reduced-motion: reduce` desativa animações, transições e transformações de feedback.

## Aplicação e manutenção

`design-system.css` contém os tokens e a camada visual comum; `style.css` mantém a estrutura e os estilos preexistentes. `ui.js` centraliza ícones e ilustração. Em componentes novos, use `var(--color-forest)`, `var(--space-5)` e as classes compartilhadas em vez de introduzir paletas ou estilos paralelos. As receitas, a chave de localStorage, backups, saldos e cálculos não mudam com a identidade visual.

Validação realizada: build de produção; fluxos de despesas e backups; filtros do guia; cálculo de receitas; sete páginas em larguras de 360, 390, 768, 1024 e 1440 px; diálogo móvel; respeito a redução de movimento. Essas verificações não equivalem a uma auditoria completa de acessibilidade com leitores de tela.

## Dashboard analítico

Indicadores em quatro colunas no desktop e duas no celular. Gráficos em duas colunas a partir de 901 px, uma coluna abaixo desse ponto. Altura padrão de 260 px (240 px no celular), e altura ajustável para despesas com muitas categorias. Séries: receitas `#63823C`, despesas `#A3442C`, ovos `#63823C` com preenchimento a baixa opacidade. Dicas de valores usam fundo floresta e texto branco. Barras e pontos aceitam toque/clique, com detalhamento dos registros; tabelas e botões fornecem alternativas por teclado. Tooltips e animações não são a única forma de acessar valores. O plantel é rotulado como saldo atual; os demais gráficos seguem o filtro inclusivo de datas. Gráficos não criam dados artificiais.

## Adaptação de campo (celular)

A camada `field.css` aumenta o corpo e os controles móveis: texto principal 16 px, apoio 14–15 px, formulário 17–18 px, ações de 56–64 px. Texto #173721 / apoio #40513E sobre branco; bordas #BDC9B1. A navegação inferior tem quatro ações fixas e menu para os demais destinos. A tela inicial mostra o dia atual; análises extensas ficam em seção opcional. Tabelas recebem cartões com rótulos. Modal móvel usa altura visível e rodapé aderente ao teclado. Login tem tela própria de alto contraste; mensagens de rede distinguem preparação, queda de sinal, necessidade de login online e atualização disponível. Ver MOBILE.md e SECURITY.md para comportamento e limites.
