import { notFound } from "next/navigation";
import StoreShell from "@/components/store-shell";
import ProductDetail from "@/components/product-detail";
import { getCatalog } from "@/lib/store-data";
import { getPublishedReviews } from "@/lib/store-data";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const [{ items }, { slug }] = await Promise.all([getCatalog(), params]);
  const product = items.find((item) => item.slug === slug);
  if (!product) return { title: "Product not found — Ropca Designs" };
  return {
    title: `${product.name} — Ropca Designs`,
    description: `${product.description} Fits: ${product.compatibility}.`,
    openGraph: { title: `${product.name} — Ropca Designs`, description: product.description, images: [product.image.startsWith("http") ? product.image : `https://images.unsplash.com/${product.image}?auto=format&fit=crop&w=1200&q=85`] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ items, demo }, { slug }] = await Promise.all([getCatalog(), params]);
  const product = items.find((item) => item.slug === slug);
  if (!product) notFound();
  const reviews = await getPublishedReviews(product.id);
  return <StoreShell><ProductDetail product={product} demo={demo} reviews={reviews} /></StoreShell>;
}
