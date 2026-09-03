import type { APIRoute } from "astro";
import { isValidAdminSession, ADMIN_COOKIE } from "../../../lib/admin-auth";
import { updateOrderStatus } from "../../../lib/update-order";
import { SITE } from "../../../config/site.config";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get(ADMIN_COOKIE)?.value;
  if (!(await isValidAdminSession(token))) {
    return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Corpo da requisição inválido." }), { status: 400 });
  }

  const orderId = String(body?.orderId ?? "");
  const status = body?.status ? String(body.status) : undefined;
  const trackingCode = typeof body?.trackingCode === "string" ? body.trackingCode.trim() : undefined;

  const host = request.headers.get("host") || SITE.productionHost;
  const result = await updateOrderStatus(orderId, status, host, trackingCode);
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), { status: result.error === "Pedido não encontrado." ? 404 : 400 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
