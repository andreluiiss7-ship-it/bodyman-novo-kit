import { kv } from "@vercel/kv";
import { getOrderStatus, CARRIER_NAME } from "../data/order-status";
import { SITE } from "../config/site.config";

const RESEND_API = "https://api.resend.com/emails";
const DEFAULT_FROM = SITE.email.from;
const TRACKING_STATUSES = new Set(["shipped", "in_transit", "out_for_delivery", "delivered"]);

const STORE_NAME = SITE.storeName;
const { brandDark: BRAND_DARK, brandGold: BRAND_GOLD, brandCream: BRAND_CREAM } = SITE.email;

interface OrderForEmail {
  orderId: string;
  cliente?: { nome?: string; email?: string };
  trackingCode?: string | null;
  offer?: { name?: string; quantity?: number; kit?: { fragrance?: string } } | null;
}

interface EmailContent {
  clienteNome: string;
  orderId: string;
  heading: string;
  body: string;
  trackUrl: string;
  trackingCode?: string | null;
  produto?: string | null;
}

function buildEmailHtml({ clienteNome, orderId, heading, body, trackUrl, trackingCode, produto }: EmailContent) {
  const greeting = clienteNome ? `Olá, ${clienteNome}!` : "Olá!";
  return `
  <div style="background: ${BRAND_CREAM}; padding: 24px 12px; font-family: Arial, Helvetica, sans-serif;">
    <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e7e1d3;">

      <!-- Cabeçalho da marca -->
      <div style="background: ${BRAND_DARK}; padding: 20px 24px; text-align: center;">
        <div style="letter-spacing: 0.28em; font-size: 13px; color: ${BRAND_GOLD}; text-transform: uppercase; font-weight: bold;">${STORE_NAME}</div>
      </div>

      <!-- Corpo -->
      <div style="padding: 28px 24px; color: #223; ">
        <h1 style="font-size: 21px; line-height: 1.3; margin: 0 0 16px; color: ${BRAND_DARK};">${heading}</h1>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 12px;">${greeting}</p>
        <p style="font-size: 15px; line-height: 1.65; margin: 0 0 20px; color: #333;">${body}</p>

        <!-- Resumo do pedido -->
        <div style="background: ${BRAND_CREAM}; border: 1px solid #e7e1d3; border-radius: 10px; padding: 14px 16px; margin: 0 0 20px;">
          <p style="margin: 0 0 6px; font-size: 12px; color: #967140; text-transform: uppercase; letter-spacing: 0.08em;">Seu pedido</p>
          <p style="margin: 0; font-size: 18px; font-weight: bold; color: ${BRAND_DARK};">Nº ${orderId}</p>
          ${produto ? `<p style="margin: 6px 0 0; font-size: 14px; color: #333;">${produto}</p>` : ""}
          ${
            trackingCode
              ? `<p style="margin: 12px 0 0; font-size: 14px; color: #333;"><strong>Rastreio ${CARRIER_NAME}:</strong> ${trackingCode}<br><span style="font-size: 12px; color: #6b6b6b;">(o código de rastreio é o mesmo número do seu pedido)</span></p>`
              : ""
          }
        </div>

        <!-- CTA -->
        <div style="text-align: center; margin: 0 0 8px;">
          <a href="${trackUrl}" style="display: inline-block; background: ${BRAND_DARK}; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: bold;">
            Acompanhar meu pedido
          </a>
        </div>
        <p style="text-align: center; font-size: 12px; color: #8a8a8a; margin: 8px 0 0; word-break: break-all;">
          ou copie este link: ${trackUrl}
        </p>
      </div>

      <!-- Rodapé de confiança -->
      <div style="background: ${BRAND_CREAM}; border-top: 1px solid #e7e1d3; padding: 18px 24px;">
        <p style="font-size: 12px; line-height: 1.6; color: #6b6b6b; margin: 0 0 8px;">
          <strong style="color: ${BRAND_DARK};">Por que você recebeu este e-mail?</strong><br>
          Você fez uma compra na loja ${STORE_NAME}. Este é um e-mail oficial sobre o andamento do seu pedido — guarde-o para acompanhar a entrega.
        </p>
        <p style="font-size: 12px; line-height: 1.6; color: #6b6b6b; margin: 0;">
          Ficou com alguma dúvida? É só responder este e-mail que a nossa equipe te ajuda. 💚
        </p>
      </div>

    </div>
  </div>
  `;
}

export async function sendOrderStatusEmail(order: OrderForEmail, statusId: string, host: string): Promise<void> {
  const def = getOrderStatus(statusId);
  const to = order.cliente?.email;
  if (!def?.email || !to) return;

  const apiKey = import.meta.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[resend] RESEND_API_KEY não configurado — e-mail não enviado:", statusId, order.orderId);
    return;
  }

  // Idempotência: no máximo 1 e-mail por (pedido, status), mesmo com cron, admin,
  // webhook e page-load concorrendo na mesma transição.
  const dedupeKey = `email-sent:${order.orderId}:${statusId}`;
  const firstSend = await kv.set(dedupeKey, 1, { nx: true, ex: 60 * 60 * 24 * 7 });
  if (firstSend === null) return;

  const from = import.meta.env.RESEND_FROM_EMAIL || DEFAULT_FROM;
  const trackUrl = `https://${host}/rastrear-pedido?codigo=${order.orderId}`;
  const subject = def.email.subject.replace("{orderId}", order.orderId);
  const showTracking = TRACKING_STATUSES.has(statusId) ? order.trackingCode : undefined;
  const produto = order.offer?.name
    ? (order.offer.quantity && order.offer.quantity > 1
        ? `${order.offer.quantity}x ${order.offer.name}`
        : order.offer.name) + (order.offer.kit?.fragrance ? ` — Fragrância: ${order.offer.kit.fragrance}` : "")
    : null;
  const html = buildEmailHtml({
    clienteNome: order.cliente?.nome ?? "",
    orderId: order.orderId,
    heading: def.email.heading,
    body: def.email.body,
    trackUrl,
    trackingCode: showTracking,
    produto,
  });

  try {
    const resp = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!resp.ok) {
      console.error("[resend] falha ao enviar e-mail:", resp.status, await resp.text());
      await kv.del(dedupeKey);
    }
  } catch (err) {
    console.error("[resend] erro ao chamar a API da Resend:", err);
    await kv.del(dedupeKey);
  }
}
