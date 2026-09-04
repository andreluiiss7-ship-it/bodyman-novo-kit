/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  CONFIGURAÇÃO DO PRODUTO — edite ESTE arquivo para cada novo funil.
 * ─────────────────────────────────────────────────────────────────────────────
 *  Este é o único lugar onde ficam os dados específicos do produto/loja.
 *  Todo o backend de entrega (admin, e-mails, rastreio, automação de status)
 *  lê daqui. Depois de editar isto, ajuste também:
 *    - As CORES do site em  src/styles/global.css  (tokens --wine / --pix / ...)
 *    - O PRODUTO (nome/preço) em  src/data/offer.ts  e o frete em  src/data/shipping.ts
 *    - O TOM dos e-mails em  src/data/order-status.ts  (opcional)
 *  Segredos (Korvex, Resend, senha do admin) vão em variáveis de ambiente na
 *  Vercel — NUNCA neste arquivo. Veja .env.example.
 */
export const SITE = {
  /** Nome da loja/marca. Aparece nos e-mails, títulos e no admin. */
  storeName: "BODYMAN",

  /** Nome do produto. Interpolado nos corpos de e-mail de status. */
  productName: "Kit Body Splash Vibration + Blunn + Infalível Fero",

  /** Nome da plataforma no dashboard da UTMify (sem espaços, MAIÚSCULAS). */
  utmifyPlatform: "BODYMAN",

  /** Prefixo do código de pedido (ex: "ML" → ML12345678). 2–3 letras. */
  orderIdPrefix: "BM",

  /**
   * ⚠️ ÍNDICE DEDICADO deste produto no Vercel KV.
   * Se você REUSAR o mesmo KV entre vários produtos, esta chave PRECISA ser
   * única por produto — senão os pedidos de produtos diferentes se misturam
   * no mesmo admin. Use um slug do produto: "orders:index:<slug>".
   */
  kvIndexKey: "orders:index:bodyman-novo-kit",

  /** Nome da transportadora própria — aparece no admin, e-mails e rastreio. */
  carrierName: "ENVIO EXPRESS",

  /** Domínio de produção — usado como fallback nos links dos e-mails/webhook. */
  productionHost: "bodyman-novo-kit.vercel.app",

  /**
   * ID do Meta Pixel. Deixe "" para desativar (nenhum script do Pixel é injetado).
   * Preencha com o ID do seu Pixel pra rastrear PageView/InitiateCheckout/Purchase.
   */
  metaPixelId: "1056359963513194",

  email: {
    /**
     * Remetente dos e-mails. Para chegar em clientes reais, use um domínio
     * VERIFICADO na Resend (ex: "Minha Loja <pedidos@seudominio.com.br>").
     * Pode ser sobrescrito pela env var RESEND_FROM_EMAIL sem editar o código.
     * O padrão "onboarding@resend.dev" SÓ entrega na sua própria conta Resend.
     */
    from: "BODYMAN <onboarding@resend.dev>",
    /** Cores do template HTML dos e-mails (hex) — combine com a paleta de
     * src/styles/global.css (--wine/--cream). */
    brandDark: "#3d2c14",
    brandGold: "#c9923a",
    brandCream: "#faf6ee",
  },

  /**
   * Automação do pipeline de entrega. Horas contadas a partir do pagamento
   * aprovado (paid). Dali em diante (out_for_delivery, delivered) é manual.
   */
  autoRules: [
    { status: "processing", hoursAfterPaid: 24 },
    { status: "shipped", hoursAfterPaid: 168 },
    { status: "in_transit", hoursAfterPaid: 216 },
  ] as Array<{ status: string; hoursAfterPaid: number }>,
};
