import type { Product } from "@/lib/catalog";

export type CartLine = { product: Product; quantity: number; variant?: string };

const emptyCart: CartLine[] = [];
let cachedRaw: string | null = null;
let cachedCart: CartLine[] = emptyCart;
let cachedCustomCodeRaw: string | null = null;
let cachedCustomCode = "";
const listeners = new Set<() => void>();

function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Partial<CartLine>;
  return Boolean(
    line.product &&
    typeof line.product.id === "string" &&
    typeof line.product.name === "string" &&
    typeof line.product.price === "number" &&
    Number.isInteger(line.quantity) &&
    line.quantity! > 0 &&
    line.quantity! <= 99 &&
    (line.variant === undefined || typeof line.variant === "string"),
  );
}

export function getCartSnapshot(): CartLine[] {
  if (typeof window === "undefined") return emptyCart;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem("ropca-cart");
  } catch (error) {
    console.error("Could not read the saved cart.", error);
    return emptyCart;
  }
  if (raw === cachedRaw) return cachedCart;
  cachedRaw = raw;
  if (!raw) {
    cachedCart = emptyCart;
    return cachedCart;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    cachedCart = Array.isArray(parsed) ? parsed.filter(isCartLine) : emptyCart;
  } catch (error) {
    console.error("Could not restore the saved cart.", error);
    cachedCart = emptyCart;
  }
  return cachedCart;
}

export function getServerCartSnapshot() {
  return emptyCart;
}

export function getCustomRequestCode() {
  if (typeof window === "undefined") return "";
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem("ropca-custom-reference");
  } catch (error) {
    console.error("Could not read the custom brief reference.", error);
    return "";
  }
  if (raw === cachedCustomCodeRaw) return cachedCustomCode;
  cachedCustomCodeRaw = raw;
  cachedCustomCode = raw ?? "";
  return cachedCustomCode;
}

export function getServerCustomRequestCode() {
  return "";
}

function notify() {
  listeners.forEach((listener) => listener());
}

function onStorage(event: StorageEvent) {
  if (event.key === "ropca-cart") {
    cachedRaw = null;
    getCartSnapshot();
    notify();
  }
  if (event.key === "ropca-custom-reference") {
    cachedCustomCodeRaw = null;
    getCustomRequestCode();
    notify();
  }
}

export function subscribeCart(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export function updateCart(update: (current: CartLine[]) => CartLine[]) {
  const next = update(getCartSnapshot());
  const raw = JSON.stringify(next);
  try {
    window.localStorage.setItem("ropca-cart", raw);
  } catch (error) {
    console.error("Could not persist the shopping cart.", error);
  }
  cachedRaw = raw;
  cachedCart = next;
  notify();
}

export function clearCart() {
  try {
    window.localStorage.removeItem("ropca-cart");
  } catch (error) {
    console.error("Could not clear the saved cart.", error);
  }
  cachedRaw = null;
  cachedCart = emptyCart;
  notify();
}

export function saveCustomRequestCode(code: string) {
  const normalized = code.trim().toUpperCase();
  try {
    if (normalized) window.sessionStorage.setItem("ropca-custom-reference", normalized);
    else window.sessionStorage.removeItem("ropca-custom-reference");
  } catch (error) {
    console.error("Could not save the custom brief reference.", error);
  }
  cachedCustomCodeRaw = normalized || null;
  cachedCustomCode = normalized;
  notify();
}
