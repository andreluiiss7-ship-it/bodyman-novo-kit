// Autoridade única sobre PREÇO/quantidade dos combos. Server-side (criar-pix.ts)
// só usa KITS[i].price — jamais um preço vindo do cliente. Cliente pode escolher
// o kit via `data-i="0|1|2"`, mas a linha de item enviada ao Korvex é montada
// aqui a partir do índice validado.
export interface Kit {
  i: number;
  qty: number;
  name: string;
  price: number;
  original: number;
  perUnit: number;
  badge?: string;
  hint?: string;
  /** Só true no kit de 1 frasco — exige escolher 1 das FRAGRANCES no checkout. */
  requiresFragrance?: boolean;
}

export const FRAGRANCES = ["Vibration", "Blunn", "Infalível Fero"] as const;
export type Fragrance = (typeof FRAGRANCES)[number];

export const KITS: Kit[] = [
  { i: 0, qty: 1, name: "1 Frasco 200ml", price: 29.99, original: 69.90, perUnit: 29.99,
    requiresFragrance: true, hint: "Escolha sua fragrância favorita" },
  { i: 1, qty: 3, name: "3 Frascos · Vibration + Blunn + Infalível Fero", price: 67.98, original: 209.70, perUnit: 22.66,
    badge: "Econômico · -68%", hint: "R$ 22,66 por frasco · Frete grátis" },
  { i: 2, qty: 6, name: "6 Frascos · Dois de cada fragrância", price: 79.90, original: 419.40, perUnit: 13.32,
    badge: "MAIS VENDIDO · -81%", hint: "R$ 13,32 por frasco · Frete grátis" },
];

export const DEFAULT_KIT_INDEX = 2;

export function getKit(i: number): Kit {
  if (!Number.isFinite(i)) return KITS[DEFAULT_KIT_INDEX];
  return KITS.find((k) => k.i === i) ?? KITS[DEFAULT_KIT_INDEX];
}

export function discountPercent(kit: Kit): number {
  return Math.round((1 - kit.price / kit.original) * 100);
}
