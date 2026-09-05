import type { APIRoute } from "astro";
import { kv } from "@vercel/kv";
import { sendUtmifyOrder, utmifyDate, type UtmifyOrder } from "./_utmify";
import { sendMetaCapiPurchase } from "./_meta-capi";
import { sendOrderStatusEmail } from "../../lib/resend";
import { SITE } from "../../config/site.config";

export const prerender = false;

// Valores possíveis do campo transaction.status, conforme /docs/enums da Korvex.
const STATUS_MAP: Record<string, string> = {
  COMPLETED: "paid",
  PENDING: "pending",
  FAILED: "failed",
  REFUNDED: "refunded",
  CHARGED_BACK: "charged_back",
};

// Mapeia o status interno -> status que a UTMify espera.
const UTMIFY_STATUS: Record<string, UtmifyOrder["status"]> = {
  paid: "paid",
  refunded: "refunded",
  charged_back: "chargedback",
};

export const POST: APIRoute = async ({ request }) => {
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Payload inválido." }), { status: 400 });
  }

  // O payload NÃO tem `transaction.identifier` — só `transaction.id` (ID interno
  // da Korvex). O nosso orderId, enviado como `metadata: { orderId }` na criação
  // da cobrança, é ecoado de volta em `trackProps.orderId` — é esse o campo usado
  // para casar o webhook com o pedido salvo no KV.
  const identifier: string | undefined = payload?.trackProps?.orderId;
  const status: string | undefined = payload?.transaction?.status;

  if (!identifier) {
    return new Response(JSON.stringify({ error: "Identificador do pedido (trackProps.orderId) ausente no payload." }), { status: 400 });
  }

  const key = `order:${identifier}`;
  const current = (await kv.get(key)) as { utmifyOrder?: UtmifyOrder; status?: string; statusTimestamps?: Record<string, number>; [k: string]: unknown } | null;
  const internalStatus = (status && STATUS_MAP[status]) || "unknown";
  const ORDER_TTL_SECONDS = 60 * 60 * 24 * 30;

  const statusChanged = current?.status !== internalStatus;
  const statusTimestamps = { ...(current?.statusTimestamps || {}) };
  if (statusChanged) statusTimestamps[internalStatus] = statusTimestamps[internalStatus] ?? Date.now();

  await kv.set(
    key,
    {
      ...(current || {}),
      status: internalStatus,
      event: payload.event,
      transactionId: payload?.transaction?.id,
      statusTimestamps,
      updatedAt: Date.now(),
    },
    { ex: ORDER_TTL_SECONDS }
  );

  // ===== UTMify: reenvia o pedido com o novo status (paid / refunded / chargedback) =====
  const utmifyStatus = UTMIFY_STATUS[internalStatus];
  if (utmifyStatus && current?.utmifyOrder) {
    const now = utmifyDate();
    const updated: UtmifyOrder = {
      ...current.utmifyOrder,
      status: utmifyStatus,
      approvedDate: utmifyStatus === "paid" ? now : current.utmifyOrder.approvedDate,
      refundedAt: utmifyStatus === "refunded" ? now : null,
    };
    await sendUtmifyOrder(updated);
  } else if (utmifyStatus && !current?.utmifyOrder) {
    console.warn("[webhook-pix] pedido sem utmifyOrder no KV (expirado?), não foi possível reenviar à UTMify:", identifier);
  }

  // ===== Resend: avisa o cliente por e-mail quando o pagamento é aprovado (só na transição) =====
  if (internalStatus === "paid" && statusChanged) {
    await sendOrderStatusEmail(
      { orderId: identifier, cliente: current?.cliente as any, offer: (current as any)?.offer, trackingCode: (current as any)?.trackingCode ?? null },
      "paid",
      request.headers.get("host") || SITE.productionHost
    );
  }

  // ===== Meta Conversions API: Purchase server-side (só na transição pra "paid") =====
  // Cobre o caso do cliente fechar a aba antes do polling em checkout.ts confirmar —
  // aí o fbq('track', 'Purchase') do navegador nunca dispara. event_id = orderId,
  // igual ao eventID usado no fbq do navegador, pro Meta deduplicar os dois envios.
  if (internalStatus === "paid" && statusChanged) {
    const order = current as any;
    if (order?.offer && order?.cliente) {
      await sendMetaCapiPurchase({
        orderId: identifier,
        value: Number(order.offer.amount ?? order.offer.kit?.price ?? 0),
        productId: order.offer.id,
        productName: order.offer.name,
        cliente: order.cliente,
        clientIp: order.clientIp ?? null,
        userAgent: order.userAgent ?? null,
        fbp: order.meta?.fbp ?? null,
        fbc: order.meta?.fbc ?? null,
        eventSourceUrl: `https://${request.headers.get("host") || SITE.productionHost}/`,
      });
    } else {
      console.warn("[webhook-pix] pedido sem offer/cliente no KV (expirado?), Purchase não enviado ao Meta:", identifier);
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
