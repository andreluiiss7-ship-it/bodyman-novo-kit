import { kv } from "@vercel/kv";
import { sendOrderStatusEmail } from "./resend";
import { ORDERS_INDEX_KEY } from "./kv-keys";
import { SITE } from "../config/site.config";

/**
 * Automação do pipeline de entrega (transportadora própria — SITE.carrierName).
 * As regras (quantas horas após o pagamento cada status dispara) ficam em
 * site.config.ts → SITE.autoRules. Padrão:
 *   +24h  (dia 1) -> processing   (Preparando pedido)
 *   +168h (dia 7) -> shipped      (Pedido enviado — código de rastreio = código do pedido)
 *   +216h (dia 9) -> in_transit   (Pedido a caminho)
 * Dali em diante — "Saiu para entrega", "Entregue" e os estados de problema —
 * o controle é manual no admin. O cliente recebe um e-mail claro a CADA etapa.
 */
export const AUTO_RULES: Array<{ status: string; hoursAfterPaid: number }> = SITE.autoRules;

const PIPELINE = ["pending", "paid", "processing", "shipped", "in_transit", "out_for_delivery", "delivered"];
const AUTO_FROM = new Set(["paid", "processing", "shipped"]);
const SHIPPED_IDX = PIPELINE.indexOf("shipped");
const ORDER_TTL_SECONDS = 60 * 60 * 24 * 30;

type StoredOrder = Record<string, any>;

function paidAtOf(order: StoredOrder): number | null {
  const t = order?.statusTimestamps?.paid;
  if (typeof t === "number") return t;
  return typeof order?.createdAt === "number" ? order.createdAt : null;
}

export function nextAutoStep(order: StoredOrder): { status: string; at: number } | null {
  if (!order || !AUTO_FROM.has(order.status)) return null;
  const paidAt = paidAtOf(order);
  if (!paidAt) return null;
  const curIdx = PIPELINE.indexOf(order.status);
  for (const rule of AUTO_RULES) {
    if (PIPELINE.indexOf(rule.status) > curIdx) {
      return { status: rule.status, at: paidAt + rule.hoursAfterPaid * 3_600_000 };
    }
  }
  return null;
}

export async function advanceOrderIfDue(orderId: string, order: StoredOrder | null, host: string): Promise<StoredOrder | null> {
  if (!order || !AUTO_FROM.has(order.status)) return order;
  const paidAt = paidAtOf(order);
  if (!paidAt) return order;

  const now = Date.now();
  const curIdx = PIPELINE.indexOf(order.status);
  const statusTimestamps: Record<string, number> = { ...(order.statusTimestamps || {}) };

  const due: Array<{ status: string; at: number }> = [];
  for (const rule of AUTO_RULES) {
    const at = paidAt + rule.hoursAfterPaid * 3_600_000;
    if (now >= at && PIPELINE.indexOf(rule.status) > curIdx) {
      due.push({ status: rule.status, at });
      statusTimestamps[rule.status] = statusTimestamps[rule.status] ?? at;
    }
  }
  if (due.length === 0) return order;
  due.sort((a, b) => PIPELINE.indexOf(a.status) - PIPELINE.indexOf(b.status));

  const target = due[due.length - 1].status;
  const reachedShipped = PIPELINE.indexOf(target) >= SHIPPED_IDX;
  const trackingCode = reachedShipped ? (order.trackingCode ?? orderId) : (order.trackingCode ?? null);

  const updated: StoredOrder = { ...order, status: target, trackingCode, statusTimestamps, updatedAt: now };
  await kv.set(`order:${orderId}`, updated, { ex: ORDER_TTL_SECONDS });

  for (const step of due) {
    await sendOrderStatusEmail({ orderId, cliente: updated.cliente, trackingCode, offer: updated.offer }, step.status, host);
  }
  return updated;
}

/** Varre os pedidos mais recentes e aplica as transições vencidas (usado pelo cron). */
export async function advanceAllDueOrders(host: string, limit = 500): Promise<{ checked: number; advanced: Array<{ orderId: string; to: string }> }> {
  const ids = (await kv.zrange<string[]>(ORDERS_INDEX_KEY, 0, limit - 1, { rev: true })) ?? [];
  const advanced: Array<{ orderId: string; to: string }> = [];
  let checked = 0;

  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    if (chunk.length === 0) break;
    const orders = await kv.mget<StoredOrder[]>(...chunk.map((id) => `order:${id}`));
    await Promise.all(
      chunk.map(async (id, j) => {
        const before = orders[j];
        if (!before) return;
        checked++;
        const after = await advanceOrderIfDue(id, before, host);
        if (after && after.status !== before.status) advanced.push({ orderId: id, to: after.status });
      })
    );
  }
  return { checked, advanced };
}
