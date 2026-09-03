import type { APIRoute } from "astro";
import { createAdminSession, ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE } from "../../../lib/admin-auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Corpo da requisição inválido." }), { status: 400 });
  }

  const password = String(body?.password ?? "");
  const expected = import.meta.env.ADMIN_PASSWORD;

  if (!expected) {
    console.error("[admin/login] ADMIN_PASSWORD não configurado no ambiente.");
    return new Response(JSON.stringify({ error: "Painel admin não configurado." }), { status: 500 });
  }

  if (password !== expected) {
    return new Response(JSON.stringify({ error: "Senha incorreta." }), { status: 401 });
  }

  const token = await createAdminSession();
  cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
