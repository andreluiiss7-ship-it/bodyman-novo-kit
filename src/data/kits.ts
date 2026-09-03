// Autoridade única sobre PREÇO/quantidade dos combos. Server-side (criar-pix.ts)
// só usa KITS[i].price — jamais um preço vindo do cliente. Cliente pode escolher
// o kit via `data-kit="0|1|2"`, mas a linha de item enviada ao Korvex é montada
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
}

export const KITS: Kit[] = [
  { i: 0, qty: 1, name: "1 Frasco 200ml", price: 29.99, original: 69.90, perUnit: 29.99,
    hint: "Escolha sua fragrância favorita" },
  { i: 1, qty: 2, name: "Kit Duplo · 2 Frascos 200ml", price: 49.98, original: 139.80, perUnit: 24.99,
    badge: "Economia · -64%", hint: "R$ 24,99 por frasco" },
  { i: 2, qty: 3, name: "Kit Completo · Vibration + Blunn + Infalível Fero", price: 67.98, original: 209.70, perUnit: 22.66,
    badge: "MAIS VENDIDO · -68%", hint: "R$ 22,66 por frasco · Frete grátis" },
];

export const DEFAULT_KIT_INDEX = 2;

export function getKit(i: number): Kit {
  if (!Number.isFinite(i)) return KITS[DEFAULT_KIT_INDEX];
  return KITS.find((k) => k.i === i) ?? KITS[DEFAULT_KIT_INDEX];
}

export function discountPercent(kit: Kit): number {
  return Math.round((1 - kit.price / kit.original) * 100);
}
