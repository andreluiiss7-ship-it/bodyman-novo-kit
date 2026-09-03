import { kv } from "@vercel/kv";
import { ADMIN_EDITABLE_STATUSES } from "../data/order-status";
import { sendOrderStatusEmail } from "./resend";

export const ALLOWED_STATUS = new Set(ADMIN_EDITABLE_STATUSES);
const ORDER_TTL_SECONDS = 60 * 60 * 24 * 30;
// A partir de "enviado" o pedido precisa de código de rastreio. Na transportadora
// própria (SITE.carrierName), o código é o próprio número do pedido.
const NEEDS_TRACKING = new Set(["shipped", "in_transit", "out_for_delivery", "delivered"]);

export type UpdateOrderResult =
  | { ok: true }
  | { ok: false; error: string };

/** Aplica uma mudança de status/rastreio a um pedido e dispara o e-mail correspondente. Usado pelo admin (individual e em lote). */
export async function updateOrderStatus(
  orderId: string,
  status: string | undefined,
  host: string,
  trackingCode?: string
): Promise<UpdateOrderResult> {
  if (!orderId) return { ok: false, error: "orderId obrigatório." };
  if (status && !ALLOWED_STATUS.has(status)) return { ok: false, error: "Status inválido." };

  const key = `order:${orderId}`;
  const current = (await kv.get(key)) as Record<string, any> | null;
  if (!current) return { ok: false, error: "Pedido não encontrado." };

  const now = Date.now();
  const effectiveStatus = status ?? current.status;
  const statusChanged = Boolean(status && status !== current.status);
  const statusTimestamps = { ...(current.statusTimestamps || {}) };
  if (statusChanged) statusTimestamps[status!] = statusTimestamps[status!] ?? now;

  let nextTracking: string | null = trackingCode !== undefined ? trackingCode || null : (current.trackingCode ?? null);
  if (NEEDS_TRACKING.has(effectiveStatus) && !nextTracking) nextTracking = orderId;

  const updated = {
    ...current,
    status: effectiveStatus,
    trackingCode: nextTracking,
    statusTimestamps,
    updatedAt: now,
  };

  await kv.set(key, updated, { ex: ORDER_TTL_SECONDS });

  if (statusChanged) {
    await sendOrderStatusEmail(
      { orderId, cliente: current.cliente, trackingCode: nextTracking, offer: current.offer },
      status!,
      host
    );
  }

  return { ok: true };
}
