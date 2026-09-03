# Template PV — Página de Vendas para Produto Físico

Este repositório **não é a página de um produto específico**. É um template Astro
completo e reutilizável para gerar rapidamente páginas de venda (PV) de **qualquer
produto físico** com checkout Pix embutido, admin de pedidos e automação de entrega —
tudo já pronto, faltando só trocar o produto.

Já foi usado para clonar PVs de nichos totalmente diferentes (cosmético, curso,
suplemento, streetwear) só editando os arquivos listados abaixo. Se você está lendo
isso porque clonou este repo pra vender ALGO NOVO, comece pela seção
[Checklist pra um novo produto](#checklist-pra-um-novo-produto).

## Stack

Astro 7 (SSR) + Tailwind CSS v4 + `@astrojs/vercel`. Checkout Pix via gateway
**Korvex**, estado de pedido em **Vercel KV**, e-mails transacionais via **Resend**,
atribuição de UTM via **UTMify**, deploy na **Vercel**.

## O que já vem pronto (não precisa reconstruir)

- Página única de vendas (`src/pages/index.astro`) com hero, prova social, "3 passos",
  vídeos de UGC em marquee, comparativo antes/depois, reviews, garantia, FAQ, sticky
  buy-bar — seções padrão de PV de produto físico de conversão.
- Popup de checkout completo (`src/components/CheckoutModal.astro`): seleção de kit,
  frete, formulário de dados, geração de Pix (QR code + copia-e-cola), polling de
  status de pagamento. **Faz parte do template — não precisa mexer nele pra trocar de
  produto**, só nos textos indicados abaixo.
- Backend de entrega completo: `/admin` (login por senha), API de criação/webhook do
  Pix, rastreio de pedido, automação de avanço de status (`processing` → `shipped` →
  `in_transit`, via cron), e-mails transacionais de cada etapa.
- Páginas legais (termos, privacidade, trocas e devoluções) e página de rastreio.
- Captura de UTM + Meta Pixel + UTMify já implementados em `src/layouts/Layout.astro`.

## Checklist pra um novo produto

Edite **nesta ordem**:

### 1. Identidade do produto/loja — `src/config/site.config.ts`

Único lugar com nome da loja, nome do produto, prefixo de pedido, chave do KV,
domínio de produção e cores do template de e-mail. Leia os comentários do próprio
arquivo — cada campo já explica onde é usado.

### 2. Paleta de cores — `src/styles/global.css` (linhas ~11–35)

**Isso é regra fixa deste template: a PV sempre usa a paleta de cor do produto que
está sendo vendido, nunca uma cor fixa.** Os 5 tokens no topo do arquivo
(`--wine`, `--pix`, `--cream`, `--blush`, `--star`) são o **único** lugar que precisa
mudar — tanto a PV inteira (`index.astro`) quanto o popup de checkout
(`CheckoutModal.astro`) leem essas variáveis, então trocar os 5 tokens rebrandeia o
site inteiro de uma vez. Não redeclare cor em nenhum outro arquivo.

- `--wine` = cor primária da marca (botões, títulos, CTA)
- `--pix` = verde do Pix — recomendado não mexer, é a cor que o usuário já reconhece
- `--cream` = fundo suave (tom bem claro da `--wine`)
- `--blush` = destaque secundário (hover, fundo de card)
- `--star` = cor das estrelas de avaliação (dourado funciona com qualquer paleta)

Valores em `oklch(lightness chroma hue)`. Pra trocar a cor da marca, o jeito mais
rápido é só girar o **hue** (3º número) mantendo lightness/chroma parecidos — ou pedir
pro Claude gerar a paleta oklch a partir da cor da nova marca.

### 3. Preço e nome do produto — `src/data/offer.ts` e `src/data/kits.ts`

`offer.ts` tem o preço "âncora" único do produto. `kits.ts` tem os combos reais
vendidos no checkout (quantidade, preço, desconto, badge) — os valores atuais
("1 Tubo" / "2 Tubos" / "3 Tubos") são só exemplo de formato; troque pelos kits reais
do seu produto (ex: "1 Unidade" / "Kit com 3" / "Kit Família", etc.).

### 4. Frete — `src/data/shipping.ts`

Nomes, prazos e preços das opções de frete. Exemplo genérico já incluso.

### 5. Tom dos e-mails (opcional) — `src/data/order-status.ts`

Assunto e corpo de cada e-mail de status. `${PRODUCT}`/`${STORE}`/`${CARRIER_NAME}`
já vêm de `site.config.ts` automaticamente — só ajuste o texto se quiser um tom
diferente por produto.

### 6. Copy da página — `src/pages/index.astro`

Ao contrário dos arquivos acima, o texto de marketing (headline, subtítulos, "3
passos", comparativo antes/depois, garantia, perguntas do FAQ) está **direto no
HTML**, não em config. Edite por busca/substituição — é a mesma convenção usada nos
outros clones deste template. `title`/`description` do SEO já vêm de
`SITE.productName`; o resto é manual.

### 7. Mídia do produto — você envia, eu não invento

**Este template nunca vem com UGC, fotos de review ou vídeo de depoimento reais de
outro produto.** No lugar, ele vem com placeholders gerados (fundo liso + texto tipo
"FOTO DO PRODUTO — substitua este arquivo") nos MESMOS caminhos que o código já
referencia. Pra trocar de produto, mande os arquivos reais e eu (ou você) sobrescrevo
exatamente esses caminhos, sem tocar em código:

| Arquivo | O que é |
|---|---|
| `src/assets/products/hero.webp` | Foto principal do produto (aparece no hero e no resumo do checkout) |
| `public/before.webp` / `public/after.webp` | Comparativo antes/depois |
| `src/assets/reviews/cliente-1.webp` … `cliente-4.webp` | Fotos anexadas nas avaliações |
| `public/videos/showcase-1.mp4` … `showcase-6.mp4` | Vídeos de UGC no marquee da seção "Quem já usou, mostrou" |
| `public/main-testimonial.mp4` | Vídeo de depoimento principal |

Depois de trocar os arquivos, ainda é preciso editar em `index.astro`: os nomes/@ de
criador(a) no marquee de vídeos (hoje `Criadora 1`…`Criadora 5` / `@sua_criadora_1`…),
o título do depoimento principal, e os nomes mascarados nas avaliações (`a**a`,
`m**a s**s` etc. — hoje são placeholders de exemplo, troque pelos nomes/iniciais reais
dos seus clientes).

### 8. Páginas legais

`src/pages/termos-de-uso.astro` tem um parágrafo de exemplo sobre "uso do produto"
marcado com `TODO(produto)` — revise pra categoria real (cosmético, suplemento,
eletrônico, etc. têm linguagem de uso/contraindicação bem diferente).
`politica-de-privacidade.astro` e `trocas-e-devolucoes.astro` já são genéricos.

### 9. `astro.config.mjs`

Troque `site: 'https://minha-loja.vercel.app'` pelo domínio real de produção (o
mesmo valor de `SITE.productionHost`).

## Variáveis de ambiente

Veja `.env.example` — cada variável já está comentada com onde gerar a credencial.
Resumo: `KORVEX_PUBLIC_KEY`/`KORVEX_SECRET_KEY` (gateway Pix), `KV_REST_API_URL`/
`KV_REST_API_TOKEN` (Vercel KV, provisionar em Storage), `RESEND_API_KEY`/
`RESEND_FROM_EMAIL` (e-mails), `ADMIN_PASSWORD` (login do `/admin`),
`UTMIFY_API_TOKEN` (opcional).

⚠️ Se for reusar o **mesmo** KV entre produtos diferentes, troque `SITE.kvIndexKey`
em `site.config.ts` pra cada produto — senão os pedidos se misturam no mesmo admin.

## Deploy (Vercel)

```bash
npm install
vercel deploy --prod --yes --scope <seu-scope>
```

Projeto novo na Vercel: desative a proteção de deployment
(`vercel project protection disable <projeto> --sso`) e configure as env vars acima
no painel antes do primeiro deploy real.

## Estrutura de referência

```
src/config/site.config.ts   → identidade do produto/loja (passo 1)
src/styles/global.css       → paleta de cores (passo 2, ÚNICO lugar pra cor)
src/data/offer.ts           → preço âncora (passo 3)
src/data/kits.ts            → combos/kits do checkout (passo 3)
src/data/shipping.ts        → opções de frete (passo 4)
src/data/order-status.ts    → copy dos e-mails de status (passo 5)
src/pages/index.astro       → a PV inteira (passo 6) + mídia (passo 7)
src/components/CheckoutModal.astro → popup de checkout (não precisa editar)
src/pages/api/*             → criação/webhook do Pix, rastreio, status (não editar)
src/pages/admin/*           → painel de pedidos (não editar)
```
