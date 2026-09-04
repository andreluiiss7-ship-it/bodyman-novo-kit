import type { APIRoute } from "astro";
import { kv } from "@vercel/kv";
import { OFFER } from "../../data/offer";
import { getKit, FRAGRANCES } from "../../data/kits";
import { getShipping } from "../../data/shipping";
import { sendUtmifyOrder, utmifyDate, cleanUtm, type UtmifyOrder } from "./_utmify";
import { ORDERS_INDEX_KEY } from "../../lib/kv-keys";
import { SITE } from "../../config/site.config";

export const prerender = false;

const KORVEX_BASE = "https://app.korvex.com.br/api/v1";

const onlyDigits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

function isValidCPF(raw: string): boolean {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digits = cpf.split("").map(Number);
  const calc = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += digits[i] * (length + 1 - i);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calc(9) === digits[9] && calc(10) === digits[10];
}

function getClientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : null;
}

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Corpo da requisição inválido." }), { status: 400 });
  }

  const { kitIndex, cliente, endereco, frete, tracking, fragrance } = body || {};
  // Preço/quantidade sempre lido da tabela server-side via kitIndex validado.
  // NUNCA usar valor vindo do cliente diretamente.
  const kit = getKit(Number(kitIndex));
  const shipping = getShipping(String(frete ?? ""));

  if (!cliente?.nome || !cliente?.email || !cliente?.telefone || !isValidCPF(cliente?.cpf)) {
    return new Response(JSON.stringify({ error: "Dados do cliente incompletos ou CPF inválido." }), { status: 400 });
  }
  if (!endereco?.cep || !endereco?.rua || !endereco?.numero || !endereco?.bairro || !endereco?.cidade || !endereco?.uf) {
    return new Response(JSON.stringify({ error: "Endereço de entrega incompleto." }), { status: 400 });
  }
  // Kit de 1 frasco exige escolher a fragrância — whitelist server-side, nunca confia
  // no cliente além de "é uma dessas 3 strings exatas".
  if (kit.requiresFragrance && !FRAGRANCES.includes(fragrance)) {
    return new Response(JSON.stringify({ error: "Selecione uma fragrância válida." }), { status: 400 });
  }

  const orderId = SITE.orderIdPrefix + Date.now().toString().slice(-8) + Math.floor(10 + Math.random() * 90);

  // Preço sempre calculado no servidor a partir das tabelas de oferta/frete — nunca do valor
  // enviado pelo cliente. Combo (kit) tem PREÇO FIXO por unidade de kit — envio 1 item de
  // qty=1 com o preço total do kit pra Korvex, senão o gateway multiplica errado. Frete
  // grátis NÃO vira line item (Korvex rejeita produto com preço 0).
  const productName = kit.requiresFragrance
    ? `${OFFER.name} — ${kit.name} (${fragrance})`
    : `${OFFER.name} — ${kit.name}`;
  const products: Array<{ id: string; name: string; quantity: number; price: number }> = [
    { id: `${OFFER.id}-kit-${kit.i}`, name: productName, quantity: 1, price: kit.price },
  ];
  if (shipping.price > 0) {
    products.push({ id: `frete-${shipping.id}`, name: shipping.name, quantity: 1, price: shipping.price });
  }
  const amount = Math.round(products.reduce((sum, p) => sum + p.price * p.quantity, 0) * 100) / 100;

  const payload = {
    identifier: orderId,
    amount,
    client: {
      name: cliente.nome,
      email: cliente.email,
      phone: cliente.telefone,
      document: onlyDigits(cliente.cpf),
    },
    products,
    callbackUrl: `https://${request.headers.get("host")}/api/webhook-pix`,
    metadata: { orderId },
  };

  let data: any;
  try {
    const resp = await fetch(`${KORVEX_BASE}/gateway/pix/receive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-public-key": import.meta.env.KORVEX_PUBLIC_KEY ?? "",
        "x-secret-key": import.meta.env.KORVEX_SECRET_KEY ?? "",
      },
      body: JSON.stringify(payload),
    });
    data = await resp.json();
    if (!resp.ok) {
      console.error("[criar-pix] Korvex rejeitou a requisição:", resp.status, JSON.stringify(data), "payload enviado:", JSON.stringify(payload));
      return new Response(JSON.stringify({ error: data.message || "Falha ao gerar cobrança Pix." }), { status: resp.status });
    }
  } catch (err) {
    console.error("[criar-pix] erro ao chamar Korvex:", err);
    return new Response(JSON.stringify({ error: "Não foi possível conectar ao gateway de pagamento." }), { status: 502 });
  }

  const createdAt = utmifyDate();
  const amountInCents = Math.round(amount * 100);
  const gatewayFeeInCents = data.fee ? Math.round(Number(data.fee) * 100) : 0;
  const t = tracking || {};

  const utmifyOrder: UtmifyOrder = {
    orderId,
    platform: SITE.utmifyPlatform,
    paymentMethod: "pix",
    status: "waiting_payment",
    createdAt,
    approvedDate: null,
    refundedAt: null,
    customer: {
      name: cliente.nome,
      email: cliente.email,
      phone: onlyDigits(cliente.telefone),
      document: onlyDigits(cliente.cpf),
      country: "BR",
      ip: getClientIp(request),
    },
    products: [
      ...products.map((p) => ({
        id: String(p.id),
        name: p.name,
        planId: null,
        planName: null,
        quantity: p.quantity,
        priceInCents: Math.round(p.price * 100),
      })),
      ...(shipping.price === 0
        ? [{ id: `frete-${shipping.id}`, name: shipping.name, planId: null, planName: null, quantity: 1, priceInCents: 0 }]
        : []),
    ],
    trackingParameters: {
      src: cleanUtm(t.src),
      sck: cleanUtm(t.sck),
      utm_source: cleanUtm(t.utm_source),
      utm_campaign: cleanUtm(t.utm_campaign),
      utm_medium: cleanUtm(t.utm_medium),
      utm_content: cleanUtm(t.utm_content),
      utm_term: cleanUtm(t.utm_term),
    },
    commission: {
      totalPriceInCents: amountInCents,
      gatewayFeeInCents,
      userCommissionInCents: amountInCents - gatewayFeeInCents,
      currency: "BRL",
    },
    isTest: false,
  };

  await sendUtmifyOrder(utmifyOrder);

  const ORDER_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias
  const now = Date.now();

  await kv.set(
    `order:${orderId}`,
    {
      status: "pending",
      transactionId: data.transactionId,
      offer: { id: OFFER.id, name: OFFER.name, kit: { i: kit.i, name: kit.name, qty: kit.qty, price: kit.price, ...(kit.requiresFragrance ? { fragrance } : {}) }, amount },
      shipping: { id: shipping.id, name: shipping.name, price: shipping.price },
      cliente,
      endereco,
      utmifyOrder,
      trackingCode: null,
      statusTimestamps: { pending: now },
      createdAt: now,
      updatedAt: now,
    },
    { ex: ORDER_TTL_SECONDS }
  );
  await kv.zadd(ORDERS_INDEX_KEY, { score: now, member: orderId });

  return new Response(
    JSON.stringify({ orderId, pix: { code: data.pix?.code } }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};
