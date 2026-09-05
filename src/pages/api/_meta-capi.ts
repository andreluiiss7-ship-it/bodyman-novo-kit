import { createHash } from "node:crypto";
import { SITE } from "../../config/site.config";

const GRAPH_API_VERSION = "v21.0";

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

// Meta espera o telefone em E.164 sem o "+", hasheado. Nossos números são
// salvos sem DDI (ex: "47999998888") — prefixa 55 (Brasil) quando faltar.
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 11) return "55" + digits;
  return digits;
}

export interface MetaCapiPurchaseInput {
  orderId: string;
  value: number;
  productId: string;
  productName: string;
  cliente: { nome?: string; email?: string; telefone?: string };
  clientIp?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  eventSourceUrl?: string | null;
}

// Envia o Purchase pro Meta direto do servidor (Conversions API), no momento em
// que o webhook da Korvex confirma o pagamento — cobre o caso do cliente ter
// fechado a aba antes do polling client-side (checkout.ts) rodar o fbq('track').
// Usa orderId como event_id (o MESMO id que o fbq('track', 'Purchase', ..., {eventID})
// do navegador usa) pra o Meta deduplicar os dois envios em vez de contar 2x.
export async function sendMetaCapiPurchase(input: MetaCapiPurchaseInput): Promise<void> {
  const token = import.meta.env.META_CAPI_TOKEN;
  const pixelId = SITE.metaPixelId;
  if (!token || !pixelId) {
    console.warn("[meta-capi] META_CAPI_TOKEN ou metaPixelId ausente — Purchase não enviado ao Meta:", input.orderId);
    return;
  }

  const userData: Record<string, unknown> = {};
  if (input.cliente.email) userData.em = [sha256(input.cliente.email)];
  if (input.cliente.telefone) userData.ph = [sha256(normalizePhone(input.cliente.telefone))];
  if (input.cliente.nome) {
    const [fn, ...rest] = input.cliente.nome.trim().split(/\s+/);
    if (fn) userData.fn = [sha256(fn)];
    if (rest.length) userData.ln = [sha256(rest.join(" "))];
  }
  userData.external_id = [sha256(input.orderId)];
  if (input.clientIp) userData.client_ip_address = input.clientIp;
  if (input.userAgent) userData.client_user_agent = input.userAgent;
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;

  const body = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.orderId,
        action_source: "website",
        event_source_url: input.eventSourceUrl || undefined,
        user_data: userData,
        custom_data: {
          currency: "BRL",
          value: input.value,
          content_type: "product",
          content_ids: [input.productId],
          contents: [{ id: input.productId, quantity: 1, item_price: input.value }],
        },
      },
    ],
  };

  try {
    const resp = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    if (!resp.ok) {
      console.error("[meta-capi] falha ao enviar Purchase:", input.orderId, resp.status, await resp.text());
    }
  } catch (err) {
    console.error("[meta-capi] erro de rede ao enviar Purchase:", input.orderId, err);
  }
}
