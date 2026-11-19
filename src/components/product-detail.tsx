"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ShieldCheck, Truck } from "lucide-react";
import { formatPrice, productImage, type Product } from "@/lib/catalog";
import { useCart } from "@/components/store-shell";
import type { CustomerReview } from "@/lib/store-data";

export default function ProductDetail({ product, demo, reviews }: { product: Product; demo: boolean; reviews: CustomerReview[] }) {
  const [color, setColor] = useState(product.colors[0] ?? "");
  const [imageIndex, setImageIndex] = useState(0);
  const { add } = useCart();
  const gallery = product.images?.length ? product.images : [product.image];
  return <div className="wrap">
    <div style={{ paddingTop: 24 }}><Link href="/shop" className="eyebrow"><ArrowLeft size={12} style={{ display: "inline", marginRight: 7 }} />Back to shop</Link></div>
    {demo && <div className="notice" role="status">Sample product for store preview. Connect Supabase to publish live inventory and enable checkout.</div>}
    <section className="detail-layout">
      <div>
        <div className="detail-image"><Image src={productImage(gallery[imageIndex], 1300)} alt={`${product.name} graphics, image ${imageIndex + 1}`} fill sizes="(max-width: 680px) 100vw, 52vw" style={{ objectFit: "cover" }} priority /></div>
        {gallery.length > 1 && <div style={{ display: "flex", gap: 9, marginTop: 10 }}>{gallery.map((image, index) => <button key={`${image}-${index}`} onClick={() => setImageIndex(index)} aria-label={`View product image ${index + 1}`} aria-pressed={imageIndex === index} style={{ position: "relative", width: 68, height: 68, border: `1px solid ${imageIndex === index ? "var(--acid)" : "var(--line)"}`, padding: 0, background: "none", cursor: "pointer" }}><Image src={productImage(image, 150)} alt="" fill sizes="68px" style={{ objectFit: "cover" }} /></button>)}</div>}
      </div>
      <div className="detail-info">
        <div className="eyebrow">{product.category} / Ropca garage</div>
        <h1 className="display">{product.name}</h1>
        <div className="price">{formatPrice(product.price)} <span style={{ color: "var(--muted)", fontSize: 10, fontWeight: 400 }}>USD</span></div>
        <p className="description">{product.description}</p>
        <div className="detail-block"><h3>Choose your colorway</h3><div className="swatches">{product.colors.map((item) => <button key={item} className={`swatch ${color === item ? "selected" : ""}`} onClick={() => setColor(item)} aria-pressed={color === item}>{item}</button>)}</div></div>
        <div className="detail-block"><h3>Compatibility</h3><p style={{ margin: 0, color: "#c5c8c5", fontSize: 12, lineHeight: 1.7 }}>{product.compatibility}</p>{typeof product.stock === "number" && product.stock <= 5 && product.stock > 0 && <p className="eyebrow" style={{ marginTop: 10 }}>Only {product.stock} left</p>}{product.stock === 0 && <p className="notice">Currently sold out. Check back soon or ask us about a custom run.</p>}</div>
        <div className="detail-block"><h3>Verified rider reviews {reviews.length > 0 && <span style={{ color: "var(--acid)" }}>({reviews.length})</span>}</h3>
          {reviews.length ? reviews.map((review) => <article key={review.id} style={{ marginBottom: 15 }}><div className="stars" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div><strong style={{ display: "block", marginTop: 7, fontSize: 12 }}>{review.title}</strong><p style={{ color: "#c5c8c5", fontSize: 11, lineHeight: 1.7 }}>{review.body}</p><small style={{ color: "var(--muted)" }}>{review.display_name} · verified rider</small></article>) : <p style={{ color: "var(--muted)", fontSize: 11 }}>No published reviews yet. Verified buyers can leave the first one from their account.</p>}
        </div>
        <div className="detail-actions"><button className="button-primary" disabled={product.stock === 0} onClick={() => add(product, color || undefined)}>{product.stock === 0 ? "Sold out" : <>Add to cart <ArrowRight size={15} /></>}</button><Link href="/custom" className="button-secondary">Need a custom fit?</Link></div>
        <div className="detail-block" style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", color: "#c5c8c5", fontSize: 11 }}><ShieldCheck size={17} color="var(--acid)" /> Premium outdoor vinyl and durable finish</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", color: "#c5c8c5", fontSize: 11 }}><Truck size={17} color="var(--acid)" /> Free U.S. shipping on orders over $150</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", color: "#c5c8c5", fontSize: 11 }}><Check size={17} color="var(--acid)" /> Printed and packed for your next ride</div>
        </div>
      </div>
    </section>
  </div>;
}
