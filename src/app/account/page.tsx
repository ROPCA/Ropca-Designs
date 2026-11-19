"use client";

import StoreShell from "@/components/store-shell";
import { createClient } from "@/lib/supabase/browser";
import { formatAmount } from "@/lib/catalog";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { LogOut, PackageCheck } from "lucide-react";

type Order = { id: string; order_number: string; created_at: string; status: string; amount_total_cents: number; invoice_number: string | null; tracking_number: string | null; order_items: { product_id: string | null; product_name: string; quantity: number; variant: string | null }[] };
type UserInfo = { id: string; email?: string; user_metadata?: { full_name?: string } };

function AccountContent() {
  const supabase = createClient();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [fullName, setFullName] = useState("");
  const [admin, setAdmin] = useState(false);
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const load = async () => {
      const { data: { user: current }, error } = await supabase.auth.getUser();
      if (error) { if (active) setMessage(error.message); return; }
      if (!current || !active) return;
      setUser(current);
      setEmail(current.email ?? "");
      setFullName(current.user_metadata?.full_name ?? "");
      const [{ data: profile, error: profileError }, { data: userOrders, error: ordersError }] = await Promise.all([
        supabase.from("profiles").select("full_name,role").eq("id", current.id).single(),
        supabase.from("orders").select("id,order_number,created_at,status,amount_total_cents,invoice_number,tracking_number,order_items(product_id,product_name,quantity,variant)").eq("customer_id", current.id).order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      if (profileError) setMessage(`Couldn't load your account details: ${profileError.message}`);
      else { setFullName(profile.full_name ?? ""); setAdmin(profile.role === "admin"); }
      if (ordersError) setMessage(`Couldn't load your orders: ${ordersError.message}`);
      else setOrders(userOrders ?? []);
    };
    void load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) { setUser(null); setOrders([]); setAdmin(false); }
      else setUser(session.user);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [supabase]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage("");
    const result = register
      ? await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else if (register && !result.data.session) setMessage("Check your inbox to confirm your email before signing in.");
    else window.location.reload();
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    setBusy(false);
    setMessage(error ? `Couldn't update your profile: ${error.message}` : "Your profile has been updated.");
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setMessage(`Couldn't sign out: ${error.message}`);
    else { setUser(null); setOrders([]); }
  }

  return <div className="wrap">
    <section className="page-hero"><div className="eyebrow">Ropca rider account</div><h1 className="display">{user ? "Your garage." : "Welcome back."}</h1><p>Sign in to manage your details, see order updates, and keep track of your rides.</p></section>
    {!supabase ? <div className="account-card"><div className="notice">Customer accounts are unavailable until Supabase authentication is configured. Add the public Supabase URL and anon key to your environment to enable sign-in.</div></div> : user ? <section className="section-pad" style={{ display: "grid", gap: 25 }}>
      <div className="account-card" style={{ width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 20 }}>
          <div><div className="eyebrow">Account details</div><h2 style={{ margin: "9px 0 20px", fontSize: 20 }}>{email}</h2></div>
          <button className="button-secondary" onClick={signOut}><LogOut size={14} />Sign out</button>
        </div>
        <form className="account-form" onSubmit={saveProfile}><label className="field-label">Name<input className="field-input" maxLength={100} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label><button className="button-primary" disabled={busy}>Save details</button></form>
        {admin && <div style={{ marginTop: 20 }}><Link className="button-secondary" href="/admin">Open store admin</Link></div>}
      </div>
      <div><div className="section-heading"><div><div className="eyebrow">Order history</div><h2 className="display" style={{ fontSize: 34 }}>Your orders</h2></div><PackageCheck color="var(--acid)" /></div>
        {orders.length ? <div style={{ display: "grid", gap: 10 }}>{orders.map((order) => <div className="order-card" key={order.id}><div style={{ flex: 1 }}><strong style={{ fontSize: 12 }}>Order {order.order_number}</strong><p style={{ color: "var(--muted)", fontSize: 10 }}>{new Date(order.created_at).toLocaleDateString()}</p>{order.invoice_number && <p style={{ fontSize: 10 }}>Invoice: {order.invoice_number}</p>}{order.tracking_number && <p style={{ fontSize: 10 }}>Tracking: {order.tracking_number}</p>}<div style={{ color: "var(--muted)", fontSize: 10 }}>{order.order_items?.map((item) => <div key={`${item.product_id}-${item.variant}`} style={{ marginTop: 10 }}>{item.quantity}× {item.product_name}{item.variant ? ` · ${item.variant}` : ""}{item.product_id && ["paid", "processing", "shipped", "delivered"].includes(order.status) && <ReviewForm orderId={order.id} productId={item.product_id} productName={item.product_name} />}</div>)}</div></div><div style={{ textAlign: "right" }}><span className="status-pill">{order.status.replaceAll("_", " ")}</span><p style={{ fontSize: 11 }}>{formatAmount(order.amount_total_cents / 100)}</p></div></div>)}</div> : <div className="empty-state">No orders yet. <Link href="/shop" style={{ color: "var(--acid)" }}>Find your first kit <span aria-hidden>→</span></Link></div>}
      </div>
      {message && <div className="notice" role="status">{message}</div>}
    </section> : <section className="section-pad"><form className="account-card account-form" onSubmit={authenticate}>
      <div className="eyebrow">{register ? "Join the garage" : "Rider login"}</div><h2 style={{ margin: "0 0 5px", fontSize: 22 }}>{register ? "Create your account" : "Sign in to your account"}</h2>
      {register && <label className="field-label">Name<input className="field-input" required maxLength={100} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>}
      <label className="field-label">Email address<input className="field-input" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label className="field-label">Password<input className="field-input" type="password" required minLength={8} autoComplete={register ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {message && <div className="notice" role="status">{message}</div>}
      <button className="button-primary" disabled={busy}>{busy ? "One moment…" : register ? "Create account" : "Sign in"}</button>
      <button className="button-secondary" type="button" onClick={() => { setRegister(!register); setMessage(""); }}>{register ? "Already have an account? Sign in" : "New to Ropca? Create an account"}</button>
    </form></section>}
  </div>;
}

function ReviewForm({ orderId, productId, productName }: { orderId: string; productId: string; productName: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState("5");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_id: orderId, product_id: productId, rating: Number(rating), title, body }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn't submit your review.");
      setMessage(result.message);
      setOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't submit your review.");
    } finally { setBusy(false); }
  }
  return <div style={{ marginTop: 7 }}>
    {!open ? <button className="button-secondary" onClick={() => setOpen(true)} style={{ minHeight: 30, padding: "0 9px", fontSize: 8 }}>Write a verified review</button> : <form className="account-form" onSubmit={submit} style={{ maxWidth: 350, marginTop: 8 }}>
      <strong style={{ fontSize: 10 }}>Review {productName}</strong>
      <label className="field-label">Rating<select className="field-select" value={rating} onChange={(event) => setRating(event.target.value)}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label>
      <label className="field-label">Title<input className="field-input" required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label className="field-label">Your review<textarea className="field-textarea" required maxLength={2000} value={body} onChange={(event) => setBody(event.target.value)} /></label>
      <button className="button-primary" disabled={busy}>{busy ? "Submitting…" : "Submit for review"}</button>
      <button className="button-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
    </form>}
    {message && <p className="cart-note" role="status">{message}</p>}
  </div>;
}

export default function AccountPage() { return <StoreShell><AccountContent /></StoreShell>; }
