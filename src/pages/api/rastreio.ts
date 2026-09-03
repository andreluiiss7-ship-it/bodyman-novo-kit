import type { APIRoute } from "astro";
import { kv } from "@vercel/kv";
import { advanceOrderIfDue } from "../../lib/auto-advance";
import { SITE } from "../../config/site.config";

export const prerender = false;

const NOT_FOUND_MESSAGE = "Pedido não encontrado. Confira o código e o e-mail informados.";

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Corpo da requisição inválido." }), { status: 400 });
  }

  const orderId = String(body?.orderId ?? "").trim().toUpperCase();
  const email = String(body?.email ?? "").trim().toLowerCase();

  if (!orderId || !email) {
    return new Response(JSON.stringify({ error: "Informe o código do pedido e o e-mail usado na compra." }), { status: 400 });
  }

  let order = (await kv.get(`order:${orderId}`)) as Record<string, any> | null;
  if (order) {
    order = await advanceOrderIfDue(orderId, order, request.headers.get("host") || SITE.productionHost);
  }
  const clienteEmail = String(order?.cliente?.email ?? "").trim().toLowerCase();

  if (!order || clienteEmail !== email) {
    return new Response(JSON.stringify({ error: NOT_FOUND_MESSAGE }), { status: 404 });
  }

  return new Response(
    JSON.stringify({
      orderId,
      status: order.status,
      offer: { name: order.offer?.name, quantity: order.offer?.quantity },
      shipping: { name: order.shipping?.name },
      trackingCode: order.trackingCode ?? null,
      createdAt: order.createdAt ?? null,
      statusTimestamps: order.statusTimestamps ?? {},
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
