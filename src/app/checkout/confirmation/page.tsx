import Link from "next/link";
import StoreShell from "@/components/store-shell";
import { Check, PackageCheck } from "lucide-react";
import { notFound } from "next/navigation";

export const metadata = { title: "Order request received — Ropca Designs", robots: { index: false, follow: false } };

export default async function OrderConfirmationPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  if (!order || !/^RD-[A-F0-9]{12}$/i.test(order)) notFound();
  return <StoreShell><div className="wrap">
    <section className="page-hero" style={{ minHeight: "66vh", display: "flex", flexDirection: "column", alignItems: "start", justifyContent: "center" }}>
      <div className="success-mark"><Check size={25} /></div>
      <div className="eyebrow" style={{ marginTop: 24 }}>Order request received</div>
      <h1 className="display">We&apos;ll take it from here.</h1>
      <p>Your order request is in the garage queue. Ropca Designs will review availability and personally send an invoice to the email address you provided. No payment has been collected.</p>
      <p className="cart-note">Order reference: {order}. Keep this for your records.</p>
      <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}><Link href="/shop" className="button-primary">Back to the shop <PackageCheck size={15} /></Link><Link href="/account" className="button-secondary">Your account</Link></div>
    </section>
  </div></StoreShell>;
}
