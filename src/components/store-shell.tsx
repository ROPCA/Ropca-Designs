"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { formatAmount, formatPrice, productImage, type Product } from "@/lib/catalog";
import { clearCart, getCartSnapshot, getCustomRequestCode, getServerCartSnapshot, getServerCustomRequestCode, saveCustomRequestCode, subscribeCart, updateCart, type CartLine } from "@/lib/cart-store";

const lineKey = (line: Pick<CartLine, "product" | "variant">) => `${line.product.id}:${line.variant ?? ""}`;
type CartContextValue = {
  cart: CartLine[];
  count: number;
  add: (product: Product, variant?: string) => void;
  update: (key: string, quantity: number) => void;
  openCart: () => void;
  freeShippingThreshold: number;
  standardShipping: number;
  clear: () => void;
  customRequestCode: string;
  setCustomRequestCode: (code: string) => void;
};
const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside StoreShell");
  return context;
}

function CartDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { cart, update, customRequestCode, setCustomRequestCode } = useCart();
  const subtotal = cart.reduce((total, item) => total + item.product.price * item.quantity, 0);
  const { freeShippingThreshold, standardShipping } = useCart();
  const shipping = subtotal === 0 || subtotal * 100 >= freeShippingThreshold ? 0 : standardShipping / 100;

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="cart-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside className="cart-panel" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div className="cart-head">
          <h2 id="cart-title">Your cart <span style={{ color: "var(--muted)", fontSize: 12 }}>({cart.reduce((n, item) => n + item.quantity, 0)})</span></h2>
          <button className="icon-button" onClick={onClose} aria-label="Close cart"><X size={19} /></button>
        </div>
        <div className="cart-list">
          {cart.length === 0 ? (
            <div className="empty-state">Your next ride upgrade starts here.<br /><br /><Link className="button-secondary" href="/shop" onClick={onClose}>Explore the shop <ArrowRight size={14} /></Link></div>
          ) : cart.map(({ product, quantity, variant }) => (
            <div className="cart-item" key={lineKey({ product, variant })}>
              <Image src={productImage(product.image, 180)} alt="" width={76} height={82} sizes="76px" />
              <div>
                <h3>{product.name}</h3>
                <p>{variant ? `${variant} · ` : ""}{formatPrice(product.price)}</p>
                <div className="qty-control" aria-label={`${product.name} quantity`}>
                  <button aria-label="Decrease quantity" onClick={() => update(lineKey({ product, variant }), quantity - 1)}>−</button>
                  <span>{quantity}</span>
                  <button aria-label="Increase quantity" onClick={() => update(lineKey({ product, variant }), quantity + 1)}>+</button>
                </div>
              </div>
              <strong style={{ fontSize: 11 }}>{formatPrice(product.price * quantity)}</strong>
            </div>
          ))}
        </div>
        {cart.length > 0 && <div className="cart-total">
          <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
            <label className="field-label">Attach a custom design brief <span style={{ color: "var(--muted)", fontSize: 9, fontWeight: 400 }}>Optional · final design pricing is quoted separately</span>
              <input className="field-input" value={customRequestCode} onChange={(event) => setCustomRequestCode(event.target.value.toUpperCase())} placeholder="RD-XXXXXXXXXXXXXXXXXXXXXXXX" autoComplete="off" />
            </label>
          </div>
          <div className="cart-total-row"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
          <div className="cart-total-row"><span>Shipping estimate</span><span>{shipping === 0 ? "Complimentary" : formatAmount(shipping)}</span></div>
          <div className="cart-total-row grand-total"><span>Estimated total</span><span>{formatAmount(subtotal + shipping)}</span></div>
          <p className="cart-note">Shipping is estimated here; the final invoice and any applicable tax will be sent by Ropca Designs. {freeShippingThreshold > 0 ? `Free shipping over ${formatPrice(freeShippingThreshold / 100)}.` : "Shipping is complimentary."}</p>
          <Link className="button-primary" style={{ width: "100%" }} href="/checkout" onClick={onClose}>Continue to order details <ArrowRight size={15} /></Link>
        </div>}
      </aside>
    </div>
  );
}

function Header({ onCart }: { onCart: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link className="brand-mark" href="/" aria-label="Ropca Designs home">
          <span className="brand-symbol">R</span><span>ROPCA<span style={{ color: "var(--acid)" }}>.</span></span>
        </Link>
        <nav className={`main-nav ${menuOpen ? "open" : ""}`} aria-label="Main navigation">
          <Link href="/">Home</Link><Link href="/shop">Shop</Link><Link href="/shop#collections">Collections</Link>
          <Link href="/custom">Custom designs</Link><Link href="/#about">About us</Link><Link href="/#contact">Contact</Link>
        </nav>
        <div className="header-actions">
          {searchOpen && <form action="/shop" role="search" style={{ display: "flex" }}>
            <label className="sr-only" htmlFor="site-search">Search products</label>
            <input id="site-search" className="field-input" name="q" placeholder="Search gear…" autoFocus style={{ width: 145, minHeight: 34, fontSize: 11 }} />
          </form>}
          <button className="icon-button" aria-label="Search products" onClick={() => setSearchOpen((show) => !show)}><Search size={18} /></button>
          <Link className="icon-button" href="/account" aria-label="Your account"><UserRound size={18} /></Link>
          <button className="icon-button" aria-label="Open shopping cart" onClick={onCart}><ShoppingBag size={18} /><CartCount /></button>
          <button className="icon-button mobile-menu" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((show) => !show)}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>
        </div>
      </div>
    </header>
  );
}

function CartCount() {
  const { count } = useCart();
  return count > 0 ? <span className="cart-count">{count}</span> : null;
}

function Footer({ email }: { email: string }) {
  return <footer className="site-footer" id="contact">
    <div className="wrap">
      <div className="footer-top">
        <div className="footer-about"><Link className="brand-mark" href="/"><span className="brand-symbol">R</span><span>ROPCA<span style={{ color: "var(--acid)" }}>.</span></span></Link><p>Purpose-built graphics for the ones who never ride stock. Designed to stand out. Made to ride hard.</p></div>
        <div className="footer-col"><h3>Explore</h3><Link href="/shop">Shop all</Link><Link href="/shop#collections">Collections</Link><Link href="/custom">Custom designs</Link></div>
        <div className="footer-col"><h3>Support</h3><Link href="/account">Track your order</Link><a href={`mailto:${email}`}>Shipping & returns</a><a href={`mailto:${email}`}>Contact us</a></div>
        <div className="footer-col"><h3>Find your edge</h3><p style={{ color: "var(--muted)", fontSize: 11, lineHeight: 1.8 }}>Get first access to new drops and limited runs.</p><Link href="/shop">Shop the latest <ArrowRight size={12} style={{ display: "inline" }} /></Link></div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Ropca Designs. Ride your own line.</span><span>Built for the ride. Made to last.</span></div>
    </div>
  </footer>;
}

export default function StoreShell({ children }: { children: React.ReactNode }) {
  const cart = useSyncExternalStore(subscribeCart, getCartSnapshot, getServerCartSnapshot);
  const [cartOpen, setCartOpen] = useState(false);
  const [shipping, setShipping] = useState({ freeShippingThreshold: 15000, standardShipping: 995, storeEmail: "hello@ropcadesigns.com" });
  const customRequestCode = useSyncExternalStore(subscribeCart, getCustomRequestCode, getServerCustomRequestCode);

  useEffect(() => {
    let active = true;
    void fetch("/api/products", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Couldn't refresh product details.");
        const catalog = result.items as Product[];
        if (active && Array.isArray(catalog)) {
          const current = new Map(catalog.map((product) => [product.id, product]));
          updateCart((items) => items.map((item) => current.has(item.product.id) ? { ...item, product: current.get(item.product.id)! } : item));
        }
      })
      .catch((error: unknown) => console.error("Cart product details could not be refreshed.", error));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/store-settings")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Couldn't load shipping estimates.");
        if (active) setShipping({
          freeShippingThreshold: result.free_shipping_threshold_cents,
          standardShipping: result.standard_shipping_cents,
          storeEmail: result.store_email,
        });
      })
      .catch((error: unknown) => console.error("Shipping estimates could not be loaded.", error));
    return () => { active = false; };
  }, []);

  const add = useCallback((product: Product, variant?: string) => {
    updateCart((current) => {
      const key = lineKey({ product, variant });
      const existing = current.find((line) => lineKey(line) === key);
      if (existing) return current.map((line) => lineKey(line) === key ? { ...line, quantity: Math.min(99, line.quantity + 1) } : line);
      return [...current, { product, quantity: 1, ...(variant ? { variant } : {}) }];
    });
    setCartOpen(true);
  }, []);
  const update = useCallback((key: string, quantity: number) => {
    updateCart((current) => quantity <= 0 ? current.filter((line) => lineKey(line) !== key) : current.map((line) => lineKey(line) === key ? { ...line, quantity: Math.min(99, quantity) } : line));
  }, []);
  const count = useMemo(() => cart.reduce((total, line) => total + line.quantity, 0), [cart]);
  const clear = useCallback(() => {
    clearCart();
    saveCustomRequestCode("");
  }, []);
  const value = useMemo(() => ({
    cart, count, add, update, openCart: () => setCartOpen(true), clear,
    freeShippingThreshold: shipping.freeShippingThreshold,
    standardShipping: shipping.standardShipping,
    customRequestCode, setCustomRequestCode: saveCustomRequestCode,
  }), [cart, count, add, update, clear, shipping, customRequestCode]);
  const closeCart = useCallback(() => setCartOpen(false), []);
  const pathname = usePathname();

  return <CartContext.Provider value={value}>
    <Header key={pathname} onCart={() => setCartOpen(true)} />
    <main>{children}</main>
    <Footer email={shipping.storeEmail} />
    <CartDrawer open={cartOpen} onClose={closeCart} />
  </CartContext.Provider>;
}
