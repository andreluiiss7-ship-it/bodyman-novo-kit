import type { APIRoute } from "astro";
import { advanceAllDueOrders } from "../../../lib/auto-advance";
import { SITE } from "../../../config/site.config";

export const prerender = false;

/**
 * Chamado pelo Vercel Cron (vercel.json) para aplicar as transições automáticas
 * de status vencidas. Também é seguro chamar manualmente: é idempotente e só
 * envia e-mail quando um pedido de fato muda de status.
 * Se CRON_SECRET estiver definido no ambiente, exige Authorization: Bearer <secret>.
 */
export const GET: APIRoute = async ({ request }) => {
  const secret = import.meta.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "Não autorizado." }), { status: 401 });
  }

  const host = request.headers.get("host") || SITE.productionHost;
  const result = await advanceAllDueOrders(host);

  return new Response(JSON.stringify({ ok: true, ...result }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
