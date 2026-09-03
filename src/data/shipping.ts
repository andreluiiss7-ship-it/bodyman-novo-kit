export interface ShippingOption {
  id: string;
  name: string;
  description: string;
  price: number;
}

export const SHIPPING_OPTIONS: ShippingOption[] = [
  { id: "expresso", name: "Frete Expresso", description: "Até 7 dias úteis · com rastreio", price: 14.9 },
  { id: "gratis", name: "Frete Grátis", description: "Entrega econômica · 10 a 12 dias úteis", price: 0 },
];

export const DEFAULT_SHIPPING_ID = "expresso";

export function getShipping(id: string): ShippingOption {
  return SHIPPING_OPTIONS.find((s) => s.id === id) ?? SHIPPING_OPTIONS[0];
}
