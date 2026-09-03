import { SITE } from "../config/site.config";

/** Transportadora própria — aparece nos e-mails, no admin e na página de rastreio. */
export const CARRIER_NAME = SITE.carrierName;

const PRODUCT = SITE.productName;
const STORE = SITE.storeName;

export interface OrderStatusDef {
  id: string;
  label: string;
  /** Se true, é um estado de problema (não faz parte do caminho feliz do pedido). */
  isProblem?: boolean;
  /** Se ausente, nenhum e-mail é disparado nessa transição (ex: pending). */
  email?: {
    subject: string;
    heading: string;
    body: string;
  };
}

// Os corpos de e-mail usam ${PRODUCT}/${STORE}/${CARRIER_NAME} — pra trocar o tom
// por produto, edite os textos abaixo à vontade (o nome do produto já é dinâmico).
export const ORDER_STATUSES: OrderStatusDef[] = [
  { id: "pending", label: "Aguardando Pix" },
  {
    id: "paid",
    label: "Pagamento aprovado",
    email: {
      subject: `${STORE} • Pagamento confirmado do pedido {orderId}`,
      heading: "Pagamento confirmado! ✅",
      body: `Recebemos o pagamento do seu <strong>${PRODUCT}</strong> e já começamos a preparar tudo com carinho. A partir de agora, você vai receber um e-mail nosso a cada etapa da entrega — de "em preparação" até a chegada na sua casa. Pode acompanhar tudo pelo botão abaixo.`,
    },
  },
  {
    id: "processing",
    label: "Processando pedido",
    email: {
      subject: `${STORE} • Estamos preparando seu pedido {orderId}`,
      heading: "Seu pedido está sendo preparado 📦",
      body: `Seu <strong>${PRODUCT}</strong> já está sendo separado e embalado com cuidado no nosso centro de distribuição. Assim que ele for despachado, te avisamos por aqui com o código de rastreio para você acompanhar a entrega.`,
    },
  },
  {
    id: "shipped",
    label: "Pedido enviado",
    email: {
      subject: `${STORE} • Seu pedido {orderId} foi enviado`,
      heading: "Boa notícia: seu pedido foi enviado! 🚚",
      body: `Seu <strong>${PRODUCT}</strong> já foi despachado e está a caminho do seu endereço pela transportadora <strong>${CARRIER_NAME}</strong>. Acompanhe cada etapa da entrega pelo botão abaixo. <br><br><strong>Importante:</strong> na ${CARRIER_NAME} o código de rastreio é o <strong>mesmo número do seu pedido</strong> — isso é normal, pode acompanhar com tranquilidade.`,
    },
  },
  {
    id: "in_transit",
    label: "Pedido em trânsito",
    email: {
      subject: `${STORE} • Seu pedido {orderId} está a caminho`,
      heading: "Seu pedido está a caminho 🚚",
      body: `Seu <strong>${PRODUCT}</strong> está em trânsito com a <strong>${CARRIER_NAME}</strong>, seguindo para o seu endereço. Continue acompanhando pelo botão abaixo — em breve ele chega até você.`,
    },
  },
  {
    id: "out_for_delivery",
    label: "Saiu para entrega",
    email: {
      subject: `${STORE} • Seu pedido {orderId} sai para entrega hoje`,
      heading: "Seu pedido sai para entrega hoje! 🛵",
      body: `O entregador da <strong>${CARRIER_NAME}</strong> já está com o seu <strong>${PRODUCT}</strong> e ele deve chegar hoje no seu endereço. Se puder, deixe alguém disponível para receber.`,
    },
  },
  {
    id: "delivered",
    label: "Pedido entregue",
    email: {
      subject: `${STORE} • Seu pedido {orderId} foi entregue`,
      heading: "Seu pedido foi entregue! 🎉",
      body: `Seu <strong>${PRODUCT}</strong> foi entregue no endereço informado. Esperamos que você aproveite muito! Se tiver qualquer dúvida, é só responder este e-mail que a gente te ajuda.`,
    },
  },
  {
    id: "lost",
    label: "Extraviado",
    isProblem: true,
    email: {
      subject: `${STORE} • Atualização importante sobre o pedido {orderId}`,
      heading: "Precisamos te atualizar sobre seu pedido",
      body: `Identificamos um problema com o seu pedido <strong>${PRODUCT}</strong> durante o transporte (extravio). Já estamos resolvendo isso diretamente com a transportadora e vamos te dar um retorno o quanto antes. <br><br>Você não precisa fazer nada agora — e o seu pedido está garantido. Se tiver qualquer dúvida, é só responder este e-mail.`,
    },
  },
  {
    id: "stolen_truck",
    label: "Caminhão roubado",
    isProblem: true,
    email: {
      subject: `${STORE} • Atualização importante sobre o pedido {orderId}`,
      heading: "Precisamos te atualizar sobre seu pedido",
      body: `O veículo que transportava a sua encomenda <strong>${PRODUCT}</strong> sofreu um roubo durante o trajeto. Já registramos a ocorrência e estamos providenciando a solução. <br><br>Vamos entrar em contato com os próximos passos — fique tranquilo(a), você não perde o seu pedido. Qualquer dúvida, responda este e-mail.`,
    },
  },
  {
    id: "refunded",
    label: "Reembolsado",
    isProblem: true,
    email: {
      subject: `${STORE} • Reembolso do pedido {orderId} processado`,
      heading: "Seu reembolso foi processado",
      body: `O valor do seu pedido <strong>${PRODUCT}</strong> foi reembolsado. Dependendo do seu banco, pode levar alguns dias para aparecer na sua fatura ou conta.`,
    },
  },
  { id: "charged_back", label: "Estornado", isProblem: true },
  { id: "failed", label: "Pagamento falhou", isProblem: true },
];

export function getOrderStatus(id: string): OrderStatusDef | undefined {
  return ORDER_STATUSES.find((s) => s.id === id);
}

export const ADMIN_EDITABLE_STATUSES = ORDER_STATUSES.filter((s) => s.id !== "pending").map((s) => s.id);
