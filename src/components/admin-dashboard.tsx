"use client";

import StoreShell from "@/components/store-shell";
import Image from "next/image";
import { createClient } from "@/lib/supabase/browser";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ImagePlus, RefreshCw, Save, Trash2 } from "lucide-react";
import { formatAmount, formatPrice } from "@/lib/catalog";

type AdminProduct = {
  id: string; slug: string; name: string; category: string; price_cents: number; image_url: string; image_urls: string[];
  badge: string | null; description: string; compatibility: string; colors: string[]; stock: number;
  collection: string | null; active: boolean;
};
type AdminOrder = {
  id: string; order_number: string; customer_name: string; email: string; phone: string | null; status: string;
  amount_subtotal_cents: number; shipping_cents: number; amount_total_cents: number; created_at: string;
  shipping_address: { line1?: string; line2?: string | null; city?: string; region?: string; postal_code?: string; country?: string } | null;
  customer_note: string | null; invoice_number: string | null; tracking_number: string | null;
  order_items: { product_name: string; quantity: number; variant: string | null; unit_price_cents: number }[];
};
type CustomRequest = { id: string; request_code: string; name: string; email: string; model: string; style: string; color: string; rider_name: string | null; race_number: string | null; instructions: string | null; reference_url: string | null; order_id: string | null; status: string; created_at: string };
type Customer = { id: string; email: string; full_name: string | null; created_at: string };
type AdminReview = { id: string; display_name: string; rating: number; title: string; body: string; published: boolean; created_at: string; products: { name: string; slug: string } | { name: string; slug: string }[] | null };
type DashboardData = { products: AdminProduct[]; orders: AdminOrder[]; customers: Customer[]; requests: CustomRequest[]; reviews: AdminReview[]; settings: Record<string, string> };
const blankProduct = { id: "", slug: "", name: "", category: "Complete kits", price: "", image_url: "", image_urls: "", badge: "", description: "", compatibility: "", colors: "", stock: "0", collection: "", active: true };

function AdminContent() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState("products");
  const [productForm, setProductForm] = useState(blankProduct);
  const [settings, setSettings] = useState({ free_shipping_threshold_cents: "15000", standard_shipping_cents: "995", store_email: "hello@ropcadesigns.com" });
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState<"loading" | "allowed" | "denied">("loading");

  const load = useCallback(async () => {
    setErrorMessage("");
    try {
      const response = await fetch("/api/admin", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) { setAccess("denied"); return; }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn't load the dashboard.");
      setData(result as DashboardData);
      setSettings((current) => ({ ...current, ...result.settings }));
      setAccess("allowed");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't load the dashboard.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setNotice(""); setErrorMessage("");
    const body = {
      ...productForm,
      price_cents: Math.round(Number(productForm.price) * 100),
      stock: Number(productForm.stock),
      colors: productForm.colors.split(",").map((color) => color.trim()).filter(Boolean),
      image_urls: productForm.image_urls.split("\n").map((url) => url.trim()).filter(Boolean),
      badge: productForm.badge || null,
    };
    try {
      const response = await fetch("/api/admin/products", {
        method: productForm.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn't save the product.");
      setNotice(productForm.id ? "Product updated." : "Product added to your catalog.");
      setProductForm(blankProduct);
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't save the product.");
    } finally { setBusy(false); }
  }

  async function removeProduct(product: AdminProduct) {
    if (!window.confirm(`Remove "${product.name}" from the storefront?`)) return;
    setErrorMessage(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/products?id=${encodeURIComponent(product.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn't remove the product.");
      setNotice(`${product.name} was removed from the storefront.`);
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't remove the product.");
    }
  }

  async function uploadImage(file: File) {
    const supabase = createClient();
    if (!supabase) { setErrorMessage("Supabase storage is not configured."); return; }
    if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMessage("Product images must be JPG, PNG, or WebP under 5 MB."); return;
    }
    if (productForm.image_url && productForm.image_urls.split("\n").filter(Boolean).length >= 8) {
      setErrorMessage("A product can have up to eight additional gallery images."); return;
    }
    setBusy(true); setErrorMessage("");
    const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
    const path = `${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      setErrorMessage(`Image upload failed: ${error.message}`);
    } else {
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
      setProductForm((current) => ({
        ...current,
        image_url: current.image_url || urlData.publicUrl,
        image_urls: current.image_url
          ? [...current.image_urls.split("\n").filter(Boolean), urlData.publicUrl].join("\n")
          : current.image_urls,
      }));
      setNotice("Image uploaded. Save the product to publish it.");
    }
    setBusy(false);
  }

  async function updateOrder(order: AdminOrder, status: string, tracking: string, invoiceNumber: string) {
    setErrorMessage(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, tracking_number: tracking, invoice_number: invoiceNumber }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn't update the order.");
      setNotice(`Order ${order.order_number} updated.`);
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't update the order.");
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice(""); setErrorMessage("");
    try {
      const response = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn't save settings.");
      setNotice("Store settings saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't save settings.");
    } finally { setBusy(false); }
  }

  async function moderateReview(review: AdminReview) {
    try {
      const response = await fetch(`/api/admin/reviews/${review.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ published: !review.published }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn't update the review.");
      setNotice(review.published ? "Review unpublished." : "Review published.");
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't update the review.");
    }
  }

  if (access === "loading" && !data) return <div className="wrap page-hero"><div className="eyebrow">Store administration</div><h1 className="display">{errorMessage ? "Admin unavailable." : "Loading garage…"}</h1>{errorMessage && <><p>{errorMessage}</p><button className="button-secondary" onClick={() => void load()}>Try again</button></>}</div>;
  if (access === "denied") return <div className="wrap"><section className="page-hero"><div className="eyebrow">Private / store admin</div><h1 className="display">Not authorized.</h1><p>Sign in with an administrator account to manage the store.</p><div style={{ marginTop: 22 }}><Link href="/account" className="button-primary">Go to account</Link></div></section></div>;
  return <div className="wrap">
    <section className="page-hero"><Link href="/" className="eyebrow"><ArrowLeft size={12} style={{ display: "inline", marginRight: 6 }} />Ropca storefront</Link><h1 className="display">Store admin.</h1><p>Manage your catalog, shipping, orders, customers, and custom design briefs.</p></section>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 24 }}>
      {["products", "orders", "custom requests", "reviews", "customers", "settings"].map((item) => <button key={item} className={`filter-chip ${tab === item ? "active" : ""}`} onClick={() => setTab(item)}>{item}</button>)}
      <button className="button-secondary" style={{ marginLeft: "auto" }} onClick={() => void load()}><RefreshCw size={13} />Refresh</button>
    </div>
    {notice && <div className="notice" role="status">{notice}</div>}
    {errorMessage && <div className="notice error" role="alert">{errorMessage}</div>}
    {tab === "products" && <section className="section-pad">
      <div className="admin-grid">
        <form className="account-card account-form" style={{ width: "100%" }} onSubmit={saveProduct}>
          <div className="eyebrow">{productForm.id ? "Edit inventory" : "Catalog / new item"}</div><h2 style={{ margin: 0, fontSize: 21 }}>{productForm.id ? "Update product" : "Add a product"}</h2>
          <div className="form-grid">
            <label className="field-label">Product name<input className="field-input" required maxLength={160} value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} /></label>
            <label className="field-label">URL slug<input className="field-input" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={productForm.slug} onChange={(e) => setProductForm({ ...productForm, slug: e.target.value })} /></label>
            <label className="field-label">Category<input className="field-input" required value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} /></label>
            <label className="field-label">Collection<input className="field-input" value={productForm.collection} onChange={(e) => setProductForm({ ...productForm, collection: e.target.value })} /></label>
            <label className="field-label">Price (USD)<input className="field-input" type="number" min="0.01" step="0.01" required value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} /></label>
            <label className="field-label">Inventory quantity<input className="field-input" type="number" min="0" step="1" required value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} /></label>
            <label className="field-label full">Description<textarea className="field-textarea" required value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} /></label>
            <label className="field-label full">Bike compatibility<input className="field-input" required value={productForm.compatibility} onChange={(e) => setProductForm({ ...productForm, compatibility: e.target.value })} /></label>
            <label className="field-label full">Color options <span style={{ color: "var(--muted)", fontSize: 9 }}>Comma-separated</span><input className="field-input" required value={productForm.colors} onChange={(e) => setProductForm({ ...productForm, colors: e.target.value })} /></label>
            <label className="field-label">Badge (optional)<input className="field-input" value={productForm.badge} onChange={(e) => setProductForm({ ...productForm, badge: e.target.value })} /></label>
            <label className="field-label">Image URL<input className="field-input" type="url" required value={productForm.image_url} onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })} /></label>
            <label className="field-label full">Additional gallery image URLs <span style={{ color: "var(--muted)", fontSize: 9 }}>One URL per line · upload more images below</span><textarea className="field-textarea" value={productForm.image_urls} onChange={(e) => setProductForm({ ...productForm, image_urls: e.target.value })} /></label>
            <label className="button-secondary full" style={{ cursor: "pointer", justifyContent: "center" }}><ImagePlus size={15} />Upload product image<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadImage(file); e.currentTarget.value = ""; }} /></label>
          </div>
          <button className="button-primary" disabled={busy}>{busy ? "Saving…" : <><Save size={14} />{productForm.id ? "Save changes" : "Add product"}</>}</button>
          {productForm.id && <button className="button-secondary" type="button" onClick={() => setProductForm(blankProduct)}>Cancel edit</button>}
        </form>
        <div><div className="section-heading"><div><div className="eyebrow">Published catalog</div><h2 className="display" style={{ fontSize: 28 }}>{data?.products.length ?? 0} products</h2></div></div>
          <div style={{ display: "grid", gap: 9 }}>{data?.products.map((product) => <div key={product.id} className="order-card" style={{ alignItems: "center" }}>
            <Image src={product.image_url} alt="" width={54} height={58} sizes="54px" style={{ objectFit: "cover" }} /><div style={{ flex: 1 }}><strong style={{ fontSize: 11 }}>{product.name}</strong><p style={{ color: "var(--muted)", fontSize: 10 }}>{formatPrice(product.price_cents / 100)} · {product.stock} in stock · {product.active ? "Live" : "Removed"}</p></div>
            <button className="icon-button" aria-label={`Edit ${product.name}`} onClick={() => { setProductForm({ id: product.id, slug: product.slug, name: product.name, category: product.category, price: (product.price_cents / 100).toFixed(2), image_url: product.image_url, image_urls: (product.image_urls ?? []).join("\n"), badge: product.badge ?? "", description: product.description, compatibility: product.compatibility, colors: product.colors.join(", "), stock: String(product.stock), collection: product.collection ?? "", active: product.active }); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Save size={15} /></button>
            <button className="icon-button" aria-label={`Remove ${product.name}`} onClick={() => void removeProduct(product)}><Trash2 size={15} /></button>
          </div>)}</div>
        </div>
      </div>
    </section>}
    {tab === "orders" && <section className="section-pad"><div style={{ display: "grid", gap: 12 }}>{data?.orders.map((order) => <OrderRow key={order.id} order={order} customRequest={data.requests.find((item) => item.order_id === order.id)} onSave={updateOrder} />)}</div>{!data?.orders.length && <div className="empty-state">Customer invoice requests will appear here after checkout.</div>}</section>}
    {tab === "custom requests" && <section className="section-pad"><div style={{ display: "grid", gap: 12 }}>{data?.requests.map((item) => <CustomRequestRow key={item.id} item={item} onSave={async (status) => {
      const response = await fetch(`/api/admin/custom-requests/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const result = await response.json();
      if (!response.ok) setErrorMessage(result.error || "Couldn't update the custom request.");
      else { setNotice(`Request ${item.request_code} updated.`); await load(); }
    }} />)}</div>{!data?.requests.length && <div className="empty-state">Custom design briefs will appear here.</div>}</section>}
    {tab === "reviews" && <section className="section-pad"><div style={{ display: "grid", gap: 12 }}>{data?.reviews.map((review) => {
      const product = Array.isArray(review.products) ? review.products[0] : review.products;
      return <article className="order-card" key={review.id} style={{ display: "block" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}><div><span className="status-pill">{review.published ? "published" : "pending review"}</span><div className="stars" style={{ marginTop: 10 }}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div><h3 style={{ fontSize: 14 }}>{review.title}</h3><p style={{ color: "var(--muted)", fontSize: 11 }}>{review.display_name} · {product?.name ?? "Product"} · verified purchase</p><p style={{ color: "#c5c8c5", fontSize: 12, lineHeight: 1.7 }}>{review.body}</p></div><div style={{ display: "grid", alignContent: "start", gap: 12 }}><small style={{ color: "var(--muted)" }}>{new Date(review.created_at).toLocaleDateString()}</small><button className="button-secondary" onClick={() => void moderateReview(review)}>{review.published ? "Unpublish" : "Publish"}</button></div></div>
      </article>;
    })}</div>{!data?.reviews.length && <div className="empty-state">Verified customer reviews will appear here for moderation.</div>}</section>}
    {tab === "customers" && <section className="section-pad"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Customer since</th></tr></thead><tbody>{data?.customers.map((customer) => <tr key={customer.id}><td>{customer.full_name || "—"}</td><td>{customer.email}</td><td>{new Date(customer.created_at).toLocaleDateString()}</td></tr>)}</tbody></table>{!data?.customers.length && <div className="empty-state">Registered customers will appear here.</div>}</div></section>}
    {tab === "settings" && <section className="section-pad"><form className="account-card account-form" style={{ width: "100%" }} onSubmit={saveSettings}><div className="eyebrow">Store configuration</div><h2 style={{ margin: 0, fontSize: 22 }}>Shipping & contact</h2>
      <label className="field-label">Free shipping threshold (USD)<input className="field-input" type="number" min="0" step=".01" required value={(Number(settings.free_shipping_threshold_cents) / 100).toFixed(2)} onChange={(e) => setSettings({ ...settings, free_shipping_threshold_cents: String(Math.round(Number(e.target.value) * 100)) })} /></label>
      <label className="field-label">Standard shipping (USD)<input className="field-input" type="number" min="0" step=".01" required value={(Number(settings.standard_shipping_cents) / 100).toFixed(2)} onChange={(e) => setSettings({ ...settings, standard_shipping_cents: String(Math.round(Number(e.target.value) * 100)) })} /></label>
      <label className="field-label">Store contact email<input className="field-input" type="email" required value={settings.store_email} onChange={(e) => setSettings({ ...settings, store_email: e.target.value })} /></label>
      <button className="button-primary" disabled={busy}><Save size={14} />Save settings</button><p className="cart-note">Shipping amounts are estimates shown at checkout and are included in the invoice you send to the customer.</p>
    </form></section>}
  </div>;
}

function OrderRow({ order, customRequest, onSave }: { order: AdminOrder; customRequest?: CustomRequest; onSave: (order: AdminOrder, status: string, tracking: string, invoiceNumber: string) => Promise<void> }) {
  const [status, setStatus] = useState(order.status);
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(order.invoice_number ?? "");
  const [busy, setBusy] = useState(false);
  const address = order.shipping_address;
  return <article className="order-card invoice-order-card">
    <div className="invoice-order-heading"><div><span className="status-pill">{order.status.replaceAll("_", " ")}</span><h3>{order.order_number}</h3><p>{new Date(order.created_at).toLocaleString()}</p></div><strong>{formatAmount(order.amount_total_cents / 100)}</strong></div>
    <div className="invoice-order-details">
      <div><div className="eyebrow">Customer</div><strong>{order.customer_name || "—"}</strong><a href={`mailto:${order.email}`}>{order.email}</a>{order.phone && <a href={`tel:${order.phone}`}>{order.phone}</a>}</div>
      <div><div className="eyebrow">Ship to</div>{address ? <address>{address.line1}{address.line2 ? `, ${address.line2}` : ""}<br />{address.city}, {address.region} {address.postal_code}<br />{address.country}</address> : <span>Address not available</span>}</div>
    </div>
    <div className="invoice-order-items"><div className="eyebrow">Order items</div>{order.order_items?.map((item, index) => <div className="invoice-order-item" key={`${item.product_name}-${item.variant}-${index}`}><span>{item.quantity} × {item.product_name}{item.variant ? ` · ${item.variant}` : ""}</span><span>{formatAmount(item.unit_price_cents * item.quantity / 100)}</span></div>)}</div>
    {order.customer_note && <p className="invoice-customer-note"><strong>Customer note:</strong> {order.customer_note}</p>}
    {customRequest && <div className="invoice-customer-note"><strong>Attached design brief · {customRequest.request_code}</strong><p>{customRequest.model} · {customRequest.style} · {customRequest.color}</p><p>Rider: {customRequest.rider_name || "—"} · Number: {customRequest.race_number || "—"}</p>{customRequest.instructions && <p>{customRequest.instructions}</p>}{customRequest.reference_url && <a href={customRequest.reference_url} target="_blank" rel="noreferrer">View private reference image</a>}</div>}
    <div className="invoice-order-totals"><span>Subtotal · {formatAmount(order.amount_subtotal_cents / 100)}</span><span>Shipping · {order.shipping_cents ? formatAmount(order.shipping_cents / 100) : "Complimentary"}</span><strong>Order estimate · {formatAmount(order.amount_total_cents / 100)}</strong></div>
    <div className="invoice-order-actions">
      <label className="field-label">Order status<select className="field-select" value={status} onChange={(event) => setStatus(event.target.value)}>{["invoice_pending", "invoice_sent", "paid", "processing", "shipped", "delivered", "cancelled", ...(order.status === "refunded" ? ["refunded"] : [])].map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
      <label className="field-label">Invoice number<input className="field-input" maxLength={80} value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Record your invoice reference" /></label>
      <label className="field-label">Tracking number<input className="field-input" maxLength={120} value={tracking} onChange={(event) => setTracking(event.target.value)} placeholder="Add after shipping" /></label>
      <button className="button-secondary" disabled={busy} onClick={async () => { setBusy(true); await onSave(order, status, tracking, invoiceNumber); setBusy(false); }}><Save size={12} />Save order</button>
    </div>
    <p className="cart-note">Send the invoice to the customer outside the site, then mark the status as “invoice sent.”</p>
  </article>;
}

function CustomRequestRow({ item, onSave }: { item: CustomRequest; onSave: (status: string) => Promise<void> }) {
  const [status, setStatus] = useState(item.status);
  const [busy, setBusy] = useState(false);
  return <article className="order-card" style={{ display: "block" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}><div><span className="status-pill">{item.status}</span><h3 style={{ fontSize: 14 }}>{item.request_code} · {item.name}</h3><p style={{ color: "var(--muted)", fontSize: 11 }}>{item.email} · {item.model} · {item.style} · {item.color}</p><p style={{ color: "#c5c8c5", fontSize: 11 }}>Rider: {item.rider_name || "—"} · Number: {item.race_number || "—"}</p>{item.order_id && <p style={{ color: "var(--acid)", fontSize: 10 }}>Attached to order {item.order_id.slice(0, 8).toUpperCase()}</p>}{item.instructions && <p style={{ color: "#c5c8c5", fontSize: 12 }}>{item.instructions}</p>}{item.reference_url && <a className="button-secondary" href={item.reference_url} target="_blank" rel="noreferrer">View reference image</a>}</div>
      <div style={{ display: "grid", alignContent: "start", gap: 10 }}><small style={{ color: "var(--muted)" }}>{new Date(item.created_at).toLocaleDateString()}</small><select className="field-select" value={status} onChange={(event) => setStatus(event.target.value)}>{["received", "reviewing", "quoted", "closed"].map((value) => <option key={value}>{value}</option>)}</select><button className="button-secondary" disabled={busy} onClick={async () => { setBusy(true); await onSave(status); setBusy(false); }}><Save size={12} />Update status</button></div>
    </div>
  </article>;
}

export default function AdminDashboard() { return <StoreShell><AdminContent /></StoreShell>; }
