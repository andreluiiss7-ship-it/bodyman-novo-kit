const UTMIFY_ORDERS_URL = "https://api.utmify.com.br/api-credentials/orders";

export function utmifyDate(date: Date = new Date()): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function cleanUtm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("{{") || trimmed.endsWith("}}")) return null;
  return trimmed;
}

export interface UtmifyOrder {
  orderId: string;
  platform: string;
  paymentMethod: "pix";
  status: "waiting_payment" | "paid" | "refunded" | "chargedback";
  createdAt: string;
  approvedDate: string | null;
  refundedAt: string | null;
  customer: {
    name: string;
    email: string;
    phone: string;
    document: string;
    country: string;
    ip: string | null;
  };
  products: Array<{
    id: string;
    name: string;
    planId: null;
    planName: null;
    quantity: number;
    priceInCents: number;
  }>;
  trackingParameters: {
    src: string | null;
    sck: string | null;
    utm_source: string | null;
    utm_campaign: string | null;
    utm_medium: string | null;
    utm_content: string | null;
    utm_term: string | null;
  };
  commission: {
    totalPriceInCents: number;
    gatewayFeeInCents: number;
    userCommissionInCents: number;
    currency: "BRL";
  };
  isTest: boolean;
}

export async function sendUtmifyOrder(order: UtmifyOrder): Promise<void> {
  const token = import.meta.env.UTMIFY_API_TOKEN;
  if (!token) {
    console.warn("[utmify] UTMIFY_API_TOKEN não configurado — pulando envio do pedido", order.orderId);
    return;
  }
  try {
    const resp = await fetch(UTMIFY_ORDERS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-token": token },
      body: JSON.stringify(order),
    });
    if (!resp.ok) {
      console.error("[utmify] falha ao enviar pedido", order.orderId, resp.status, await resp.text());
    }
  } catch (err) {
    console.error("[utmify] erro de rede ao enviar pedido", order.orderId, err);
  }
}
