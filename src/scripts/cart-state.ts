import { DEFAULT_KIT_INDEX } from "../data/kits";

const KIT_KEY = "selected_kit_index";

let quantity = 1;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function getQuantity(): number {
  return quantity;
}

export function setQuantity(qty: number) {
  const clamped = Math.min(10, Math.max(1, Math.round(qty)));
  if (clamped === quantity) return;
  quantity = clamped;
  notify();
}

export function getSelectedKit(): number {
  if (typeof window === "undefined") return DEFAULT_KIT_INDEX;
  try {
    const v = window.localStorage.getItem(KIT_KEY);
    if (v === null) return DEFAULT_KIT_INDEX;
    const n = Number(v);
    if (n === 0 || n === 1 || n === 2) return n;
    return DEFAULT_KIT_INDEX;
  } catch {
    return DEFAULT_KIT_INDEX;
  }
}

export function setSelectedKit(i: number) {
  if (typeof window === "undefined") return;
  const clamped = i === 0 || i === 1 || i === 2 ? i : DEFAULT_KIT_INDEX;
  try {
    window.localStorage.setItem(KIT_KEY, String(clamped));
  } catch {}
  notify();
}

export function subscribeCart(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
