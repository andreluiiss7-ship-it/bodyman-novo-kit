import { SITE } from "../config/site.config";

// Catálogo do produto. Edite o preço/oferta aqui. O NOME vem do site.config.ts
// (SITE.productName) pra ficar consistente com os e-mails e o admin.
export const OFFER = {
  id: "bodyman-kit-completo",
  name: SITE.productName,
  originalPrice: 209.7,
  price: 67.98,
};

export function discountPercent(): number {
  return Math.round((1 - OFFER.price / OFFER.originalPrice) * 100);
}
