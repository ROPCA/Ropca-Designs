import Link from "next/link";
import StoreShell from "@/components/store-shell";

export default function NotFound() {
  return <StoreShell><section className="wrap page-hero" style={{ minHeight: "55vh" }}><div className="eyebrow">Looks like a wrong turn</div><h1 className="display">Not found.</h1><p style={{ marginBottom: 24 }}>That page isn&apos;t on this track. Let&apos;s get you back to the garage.</p><Link className="button-primary" href="/shop">Explore the shop</Link></section></StoreShell>;
}
