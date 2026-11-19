"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Plus, ShieldCheck, Truck, Zap } from "lucide-react";
import { categories, formatPrice, productImage, type Product } from "@/lib/catalog";
import { useCart } from "@/components/store-shell";
import type { CustomerReview } from "@/lib/store-data";

function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  return <article className="product-card">
    <div className="product-card-media">
      <Link className="product-image" href={`/products/${product.slug}`} aria-label={`View ${product.name}`}>
        {product.badge && <span className="product-badge">{product.badge}</span>}
        {product.stock === 0 && <span className="product-badge" style={{ left: "auto", right: 12, background: "#252a27", color: "white" }}>SOLD OUT</span>}
        <Image src={productImage(product.image)} alt={`${product.name} electric dirt bike graphics`} fill sizes="(max-width: 680px) 48vw, (max-width: 900px) 48vw, 25vw" />
      </Link>
      <button className="product-quick-add" onClick={() => add(product)} disabled={product.stock === 0} aria-label={product.stock === 0 ? `${product.name} is sold out` : `Add ${product.name} to cart`}>{product.stock === 0 ? "—" : <Plus size={17} />}</button>
    </div>
    <div className="product-info">
      <div><Link href={`/products/${product.slug}`}><h3>{product.name}</h3></Link><p>{product.category}</p></div>
      <strong className="product-price">{formatPrice(product.price)}</strong>
    </div>
  </article>;
}

export function ProductGrid({
  products,
  initialSearch = "",
  showFilters = true,
}: {
  products: Product[];
  initialSearch?: string;
  showFilters?: boolean;
}) {
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("featured");
  const [collection, setCollection] = useState("All collections");
  const [query, setQuery] = useState(initialSearch);
  const collections = useMemo(() => [...new Set(products.map((product) => product.collection).filter((value): value is string => Boolean(value)))].sort(), [products]);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return products
      .filter((product) => category === "All" || product.category === category)
      .filter((product) => collection === "All collections" || product.collection === collection)
      .filter((product) => !search || `${product.name} ${product.category} ${product.collection ?? ""} ${product.compatibility}`.toLowerCase().includes(search))
      .sort((a, b) => sort === "price-low" ? a.price - b.price : sort === "price-high" ? b.price - a.price : sort === "name" ? a.name.localeCompare(b.name) : 0);
  }, [products, category, collection, sort, query]);
  return <>
    {showFilters && <div className="filter-row">
      <div className="filter-chips" aria-label="Filter by product category">
        {categories.filter((item) => item !== "Custom graphics").map((item) =>
          <button key={item} className={`filter-chip ${category === item ? "active" : ""}`} onClick={() => setCategory(item)} aria-pressed={category === item}>{item}</button>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {collections.length > 0 && <><label className="sr-only" htmlFor="filter-collections">Filter collections</label><select className="sort-select" id="filter-collections" value={collection} onChange={(event) => setCollection(event.target.value)}><option>All collections</option>{collections.map((item) => <option key={item}>{item}</option>)}</select></>}
        <label className="sr-only" htmlFor="sort-products">Sort products</label>
        <select className="sort-select" id="sort-products" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name: A to Z</option>
        </select>
      </div>
    </div>}
    {showFilters && <div style={{ marginBottom: 22 }}>
      <label className="sr-only" htmlFor="catalog-search">Search products</label>
      <input id="catalog-search" className="field-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search graphics, bikes, and styles…" />
    </div>}
    {filtered.length > 0 ? <div className="product-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="empty-state">No gear matched that search. Try another bike, style, or category.</div>}
  </>;
}

function Benefits() {
  return <div className="benefits">
    <div className="benefit"><ShieldCheck className="benefit-icon" size={22} /><div><h3>Ride-ready materials</h3><p>Premium vinyl with a hard-wearing protective finish.</p></div></div>
    <div className="benefit"><Zap className="benefit-icon" size={22} /><div><h3>Precision fit</h3><p>Cut for your bike. Applied by you in your garage.</p></div></div>
    <div className="benefit"><Truck className="benefit-icon" size={22} /><div><h3>Free shipping over $150</h3><p>Every order packed with care and shipped to your door.</p></div></div>
  </div>;
}

export default function Storefront({ products, demo, reviews }: { products: Product[]; demo: boolean; reviews: CustomerReview[] }) {
  const [subscribed, setSubscribed] = useState(false);
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const bestSellers = products.filter((product) => product.badge?.toLowerCase().includes("best")).slice(0, 4);
  const newArrivals = products.filter((product) => product.badge?.toLowerCase().includes("new")).slice(0, 4);
  async function subscribe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    try {
      const response = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn't subscribe right now.");
      setSubscribed(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Couldn't subscribe right now.");
    }
  }
  return <>
    <section className="hero">
      <div className="wrap hero-inner">
        <div className="hero-kicker eyebrow">Electric dirt bike graphics · Est. for the ride</div>
        <h1 className="display">Redefine<br /><span>Your Ride.</span></h1>
        <p className="hero-copy">Built for the ones who never ride stock. Premium graphics and custom vinyl that make your electric dirt bike unmistakably yours.</p>
        <div className="hero-actions"><Link href="/shop" className="button-primary">Shop now <ArrowRight size={15} /></Link><Link href="/custom" className="button-secondary">Design your own <ArrowUpRight size={14} /></Link></div>
      </div>
      <div className="hero-meta">Designed to ride harder</div>
    </section>
    <div className="ticker" aria-label="Ropca values"><div className="ticker-track" aria-hidden="true">{Array.from({ length: 4 }, (_, i) => <span key={i}>Cut different <i>✳</i> Made to ride <i>✳</i> Built for your bike <i>✳</i> Never ride stock <i>✳</i></span>)}</div></div>
    {demo && <div className="wrap"><div className="notice" role="status">Store preview: these editable sample products are for setup and testing. Connect Supabase to publish live inventory and enable invoice order requests.</div></div>}
    <section className="wrap section-pad" id="shop">
      <div className="section-heading"><div><div className="eyebrow">The line-up</div><h2 className="display">Built to stand out.</h2></div><p>Precision-fit graphics for electric dirt bikes. Find your platform, pick your look, and make it your own.</p></div>
      <ProductGrid products={products.slice(0, 4)} showFilters={false} />
      <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}><Link href="/shop" className="button-secondary">Shop all graphics <ArrowRight size={14} /></Link></div>
    </section>
    {bestSellers.length > 0 && <section className="wrap" style={{ paddingBottom: 78 }}><div className="section-heading"><div><div className="eyebrow">Rider favorites</div><h2 className="display">Best sellers.</h2></div><Link href="/shop" className="button-secondary">Shop all <ArrowRight size={14} /></Link></div><ProductGrid products={bestSellers} showFilters={false} /></section>}
    {newArrivals.length > 0 && <section className="wrap" style={{ paddingBottom: 78 }}><div className="section-heading"><div><div className="eyebrow">Fresh from the garage</div><h2 className="display">New arrivals.</h2></div><Link href="/shop" className="button-secondary">See the drop <ArrowRight size={14} /></Link></div><ProductGrid products={newArrivals} showFilters={false} /></section>}
    <div className="wrap"><Benefits /></div>
    <section className="wrap section-pad" id="collections">
      <div className="campaign">
        <div className="campaign-content"><div className="eyebrow">Make it yours</div><h2 className="display">Your bike.<br />Your signature.</h2><p>Got a vision? Choose your bike, dial in the details, and tell our design crew what you have in mind.</p><Link className="button-secondary" href="/custom">Build your custom kit <ArrowRight size={14} /></Link></div>
        <div className="campaign-image" role="img" aria-label="Electric dirt bike styled with custom graphics" />
      </div>
    </section>
    <section className="wrap section-pad" id="about">
      <div className="section-heading"><div><div className="eyebrow">No stock energy</div><h2 className="display">Details matter.</h2></div><p>We design graphics that hit different in the driveway and hold up when the trail gets rough. Thoughtful fit, vivid print, and a finish made for the elements.</p></div>
      <div className="reviews">
        {reviews.length ? reviews.slice(0, 3).map((review) => <article className="review" key={review.id}>
          <div className="stars" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div>
          <h3 style={{ fontSize: 13 }}>{review.title}</h3><blockquote>{review.body}</blockquote>
          <div className="reviewer"><span className="avatar"><Check size={14} /></span><div><strong>{review.display_name}</strong><small>Verified rider · <Link href={`/products/${review.product.slug}`}>{review.product.name}</Link></small></div></div>
        </article>) : <div className="review" style={{ gridColumn: "1 / -1" }}><div className="eyebrow">Rider verified</div><h3 style={{ fontSize: 16 }}>Your ride. Your review.</h3><p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.7 }}>Reviews are shared by verified customers after purchase. Be the first to share the fit, finish, and ride feel once the first orders are rolling.</p></div>}
      </div>
    </section>
    <section className="wrap" style={{ paddingBottom: 44 }}>
      <div className="newsletter"><div><h2>Get first dibs on the next drop.</h2><p>New designs, limited runs, and the occasional good deal. No noise.</p></div>
        {subscribed ? <p role="status" style={{ color: "var(--acid)" }}>You&apos;re on the list. Keep an eye on your inbox.</p> : <form className="newsletter-form" onSubmit={subscribe}><label className="sr-only" htmlFor="newsletter-email">Email address</label><input id="newsletter-email" type="email" required placeholder="Your email address" value={email} onChange={(event) => setEmail(event.target.value)} /><button className="button-primary" type="submit">Sign me up <ArrowDown size={14} /></button></form>}
      </div>{notice && <p className="notice error" role="alert">{notice}</p>}
    </section>
  </>;
}

export function ShopPage({ products, initialSearch = "", demo }: { products: Product[]; initialSearch?: string; demo: boolean }) {
  return <div className="wrap">
    <section className="page-hero"><div className="eyebrow">Ropca garage / all gear</div><h1 className="display">Find your<br />next look.</h1><p>Complete graphics kits, precision-cut decals, and details made to fit your ride. Browse by category or search by bike.</p></section>
    {demo && <div className="notice" role="status">Sample catalog for store preview. Connect Supabase to manage and publish real inventory.</div>}
    <section className="section-pad" id="collections"><ProductGrid products={products} initialSearch={initialSearch} /></section>
  </div>;
}
