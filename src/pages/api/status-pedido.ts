import type { APIRoute } from "astro";
import { kv } from "@vercel/kv";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ error: 'Parâmetro "id" obrigatório.' }), { status: 400 });
  }

  const order = (await kv.get(`order:${id}`)) as Record<string, unknown> | null;
  if (!order) {
    return new Response(JSON.stringify({ error: "Pedido não encontrado." }), { status: 404 });
  }

  return new Response(JSON.stringify({ status: order.status }), { status: 200 });
};
