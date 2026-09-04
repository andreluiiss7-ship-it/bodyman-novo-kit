import { kv } from "@vercel/kv";
import { advanceOrderIfDue } from "./auto-advance";
import { ORDERS_INDEX_KEY } from "./kv-keys";

export const ORDERS_PAGE_SIZE = 20;

export interface OrderSummary {
  orderId: string;
  status: string;
  offer?: { name?: string; quantity?: number; amount?: number; kit?: { fragrance?: string } };
  shipping?: { name?: string; price?: number };
  cliente?: { nome?: string; email?: string; telefone?: string };
  endereco?: { cep?: string; rua?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; uf?: string };
  trackingCode: string | null;
  createdAt: number;
  updatedAt?: number;
  statusTimestamps: Record<string, number>;
}

/** Status que contam como venda aprovada (pra faturamento). */
const PAID_LIKE = new Set(["paid", "processing", "shipped", "in_transit", "out_for_delivery", "delivered"]);

/** Grupos de filtro usados pelos cards do admin (?g=). */
export const STATUS_GROUPS: Record<string, Set<string>> = {
  prep: new Set(["paid", "processing"]),
  transporte: new Set(["shipped", "in_transit", "out_for_delivery"]),
  problemas: new Set(["lost", "stolen_truck", "refunded", "charged_back", "failed"]),
};

export interface AdminOrdersStats {
  todayCount: number;
  todayRevenue: number;
  totalRevenue: number;
  pending: number;
  prep: number;
  transporte: number;
  delivered: number;
  problemas: number;
  /** Pedidos parados aguardando ação manual (confirmar entrega / marcar problema). */
  atencao: number;
}

/** Após esse tempo em `in_transit`/`out_for_delivery`, o pedido precisa de intervenção manual. */
const ATTENTION_RULES: Array<{ status: string; hoursInStatus: number }> = [
  { status: "in_transit", hoursInStatus: 48 },
  { status: "out_for_delivery", hoursInStatus: 24 },
];

export interface AttentionInfo {
  hoursInStatus: number;
  message: string;
}

export function getAttentionInfo(o: OrderSummary): AttentionInfo | null {
  const rule = ATTENTION_RULES.find((r) => r.status === o.status);
  if (!rule) return null;
  const enteredAt = o.statusTimestamps?.[o.status] ?? o.updatedAt ?? o.createdAt;
  const hours = (Date.now() - enteredAt) / 3_600_000;
  if (hours < rule.hoursInStatus) return null;
  const days = Math.floor(hours / 24);
  const timeText = days >= 1 ? `há ${days} dia${days > 1 ? "s" : ""}` : `há ${Math.round(hours)}h`;
  const message =
    o.status === "out_for_delivery"
      ? `Saiu para entrega ${timeText} — já chegou? marque como entregue ou como problema`
      : `Em trânsito ${timeText} — já deve ter sido entregue; confirme como entregue ou marque um problema`;
  return { hoursInStatus: hours, message };
}

export interface AdminOrdersQuery {
  page: number;
  q?: string;
  status?: string;
  group?: string;
  host: string;
}

/** Início do dia atual no horário de Brasília (UTC-3, sem horário de verão desde 2019). */
function startOfTodayBRT(): number {
  const shifted = new Date(Date.now() - 3 * 3_600_000);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) + 3 * 3_600_000;
}

/** Busca todos os pedidos no KV, aplica as transições automáticas vencidas e retorna os resumos. */
async function loadAllOrderSummaries(host: string): Promise<OrderSummary[]> {
  const ids = (await kv.zrange<string[]>(ORDERS_INDEX_KEY, 0, -1, { rev: true })) ?? [];

  const raws: Array<Record<string, any> | null> = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    if (chunk.length === 0) break;
    const vals = await kv.mget<Array<Record<string, any> | null>>(...chunk.map((id) => `order:${id}`));
    raws.push(...vals);
  }

  const advanced = await Promise.all(ids.map((id, i) => (raws[i] ? advanceOrderIfDue(id, raws[i], host) : Promise.resolve(null))));

  const summaries: OrderSummary[] = [];
  advanced.forEach((o, i) => {
    if (!o) return;
    summaries.push({
      orderId: ids[i],
      status: o.status,
      offer: o.offer,
      shipping: o.shipping,
      cliente: o.cliente,
      endereco: o.endereco,
      trackingCode: o.trackingCode ?? null,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      statusTimestamps: o.statusTimestamps ?? {},
    });
  });
  return summaries;
}

/** IDs de todos os pedidos que hoje precisam de ação manual (independente de página/filtro). */
export async function listAttentionOrderIds(host: string): Promise<string[]> {
  const summaries = await loadAllOrderSummaries(host);
  return summaries.filter((s) => getAttentionInfo(s)).map((s) => s.orderId);
}

export async function getAdminOrders(opts: AdminOrdersQuery) {
  const summaries = await loadAllOrderSummaries(opts.host);

  const t0 = startOfTodayBRT();
  const stats: AdminOrdersStats = {
    todayCount: 0,
    todayRevenue: 0,
    totalRevenue: 0,
    pending: 0,
    prep: 0,
    transporte: 0,
    delivered: 0,
    problemas: 0,
    atencao: 0,
  };
  for (const s of summaries) {
    const amount = s.offer?.amount ?? 0;
    if (PAID_LIKE.has(s.status)) {
      stats.totalRevenue += amount;
      const paidAt = s.statusTimestamps.paid ?? s.createdAt;
      if (paidAt >= t0) {
        stats.todayCount++;
        stats.todayRevenue += amount;
      }
    }
    if (s.status === "pending") stats.pending++;
    if (STATUS_GROUPS.prep.has(s.status)) stats.prep++;
    if (STATUS_GROUPS.transporte.has(s.status)) stats.transporte++;
    if (s.status === "delivered") stats.delivered++;
    if (STATUS_GROUPS.problemas.has(s.status)) stats.problemas++;
    if (getAttentionInfo(s)) stats.atencao++;
  }

  let filtered = summaries;
  if (opts.status) {
    filtered = filtered.filter((s) => s.status === opts.status);
  } else if (opts.group === "atencao") {
    filtered = filtered.filter((s) => getAttentionInfo(s));
  } else if (opts.group && STATUS_GROUPS[opts.group]) {
    const set = STATUS_GROUPS[opts.group];
    filtered = filtered.filter((s) => set.has(s.status));
  }
  if (opts.q) {
    const needle = opts.q.toLowerCase();
    const digits = needle.replace(/\D/g, "");
    filtered = filtered.filter((s) => {
      if (s.orderId.toLowerCase().includes(needle)) return true;
      if ((s.cliente?.nome ?? "").toLowerCase().includes(needle)) return true;
      if ((s.cliente?.email ?? "").toLowerCase().includes(needle)) return true;
      if (digits.length >= 4 && (s.cliente?.telefone ?? "").replace(/\D/g, "").includes(digits)) return true;
      return false;
    });
  }

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / ORDERS_PAGE_SIZE));
  const page = Math.min(Math.max(1, opts.page), totalPages);
  const orders = filtered.slice((page - 1) * ORDERS_PAGE_SIZE, (page - 1) * ORDERS_PAGE_SIZE + ORDERS_PAGE_SIZE);

  return { orders, page, totalPages, totalFiltered, totalAll: summaries.length, stats };
}
