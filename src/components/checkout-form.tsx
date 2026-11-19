"use client";

import StoreShell, { useCart } from "@/components/store-shell";
import { createClient } from "@/lib/supabase/browser";
import { formatAmount, formatPrice } from "@/lib/catalog";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Address = { line1: string; line2: string; city: string; region: string; postal_code: string; country: string };
const emptyAddress: Address = { line1: "", line2: "", city: "", region: "", postal_code: "", country: "US" };

function CheckoutContent() {
  const { cart, freeShippingThreshold, standardShipping, customRequestCode, setCustomRequestCode, clear } = useCart();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState(emptyAddress);
  const [note, setNote] = useState("");
  const [requestId, setRequestId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const subtotalCents = cart.reduce((total, item) => total + Math.round(item.product.price * 100) * item.quantity, 0);
  const shippingCents = subtotalCents === 0 || subtotalCents >= freeShippingThreshold ? 0 : standardShipping;

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active && data.user) {
        setEmail(data.user.email ?? "");
        setName(typeof data.user.user_metadata.full_name === "string" ? data.user.user_metadata.full_name : "");
      }
    });
    return () => { active = false; };
  }, []);

  function setAddressField(key: keyof Address, value: string) {
    setAddress((current) => ({ ...current, [key]: value }));
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart.length) return;
    setBusy(true);
    setErrorMessage("");
    const id = requestId || crypto.randomUUID();
    setRequestId(id);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkout_request_id: id,
          name,
          email,
          phone,
          address,
          customer_note: note,
          ...(customRequestCode.trim() ? { custom_request_code: customRequestCode.trim() } : {}),
          items: cart.map(({ product, quantity, variant }) => ({ id: product.id, quantity, variant: variant ?? null })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn't submit your order.");
      clear();
      setCustomRequestCode("");
      router.push(`/checkout/confirmation?order=${encodeURIComponent(result.order_number)}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't submit your order.");
      setBusy(false);
    }
  }

  return <div className="wrap">
    <section className="page-hero"><div className="eyebrow">Invoice request / no payment collected now</div><h1 className="display">Order details.</h1><p>Submit your order request and Ropca Designs will review it and send you an invoice separately.</p></section>
    {!cart.length ? <section className="section-pad"><div className="empty-state">Your cart is empty. <Link href="/shop" style={{ color: "var(--acid)" }}>Browse the shop →</Link></div></section> : <section className="section-pad checkout-layout">
      <form className="account-card account-form" style={{ width: "100%" }} onSubmit={submitOrder}>
        <div className="eyebrow">01 / Contact</div>
        <label className="field-label">Full name<input className="field-input" required autoComplete="name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="field-label">Email for your invoice<input className="field-input" type="email" required autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label className="field-label">Phone <span style={{ color: "var(--muted)", fontSize: 9 }}>Optional</span><input className="field-input" type="tel" autoComplete="tel" maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <div className="eyebrow" style={{ marginTop: 16 }}>02 / Shipping address</div>
        <label className="field-label">Address<input className="field-input" required autoComplete="address-line1" maxLength={120} value={address.line1} onChange={(event) => setAddressField("line1", event.target.value)} /></label>
        <label className="field-label">Apartment, suite, etc. <span style={{ color: "var(--muted)", fontSize: 9 }}>Optional</span><input className="field-input" autoComplete="address-line2" maxLength={120} value={address.line2} onChange={(event) => setAddressField("line2", event.target.value)} /></label>
        <div className="form-grid">
          <label className="field-label">City<input className="field-input" required autoComplete="address-level2" maxLength={120} value={address.city} onChange={(event) => setAddressField("city", event.target.value)} /></label>
          <label className="field-label">State / province<input className="field-input" required autoComplete="address-level1" maxLength={120} value={address.region} onChange={(event) => setAddressField("region", event.target.value)} /></label>
          <label className="field-label">Postal code<input className="field-input" required autoComplete="postal-code" maxLength={24} value={address.postal_code} onChange={(event) => setAddressField("postal_code", event.target.value)} /></label>
          <label className="field-label">Country<select className="field-select" autoComplete="country" value={address.country} onChange={(event) => setAddressField("country", event.target.value)}><option value="US">United States</option><option value="CA">Canada</option></select></label>
        </div>
        <div className="eyebrow" style={{ marginTop: 16 }}>03 / Notes</div>
        <label className="field-label">Order notes <span style={{ color: "var(--muted)", fontSize: 9 }}>Optional</span><textarea className="field-textarea" maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Anything we should know about your order?" /></label>
        <label className="field-label">Custom design brief reference <span style={{ color: "var(--muted)", fontSize: 9 }}>Optional</span><input className="field-input" maxLength={27} value={customRequestCode} onChange={(event) => setCustomRequestCode(event.target.value.toUpperCase())} placeholder="RD-XXXXXXXXXXXXXXXXXXXXXXXX" autoComplete="off" /></label>
        {errorMessage && <div className="notice error" role="alert">{errorMessage}</div>}
        <button className="button-primary" disabled={busy}>{busy ? "Submitting order…" : "Submit order request"}</button>
        <p className="cart-note">Submitting this request does not charge you. Ropca Designs will confirm availability and send a separate invoice for payment.</p>
      </form>
      <aside className="account-card checkout-summary">
        <div className="eyebrow">Order summary</div>
        <h2 style={{ margin: "8px 0 18px", fontSize: 20 }}>{cart.length} {cart.length === 1 ? "item" : "items"}</h2>
        <div style={{ display: "grid", gap: 14 }}>{cart.map(({ product, quantity, variant }) => <div key={`${product.id}:${variant ?? ""}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 11 }}><span style={{ color: "var(--muted)" }}>{product.name}{variant ? ` · ${variant}` : ""} × {quantity}</span><strong>{formatPrice(product.price * quantity)}</strong></div>)}</div>
        <div className="cart-total-row" style={{ marginTop: 20 }}><span>Subtotal estimate</span><span>{formatAmount(subtotalCents / 100)}</span></div>
        <div className="cart-total-row"><span>Shipping estimate</span><span>{shippingCents ? formatAmount(shippingCents / 100) : "Complimentary"}</span></div>
        <div className="cart-total-row grand-total"><span>Estimated total</span><span>{formatAmount((subtotalCents + shippingCents) / 100)}</span></div>
        <p className="cart-note">Final shipping and any applicable tax will be shown on the invoice we send for your approval.</p>
      </aside>
    </section>}
  </div>;
}

export default function CheckoutForm() {
  return <StoreShell><CheckoutContent /></StoreShell>;
}
