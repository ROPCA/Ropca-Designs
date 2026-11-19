import { products, type Product } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  collection: string | null;
  price_cents: number;
  stock: number;
  image_url: string;
  image_urls: string[];
  badge: string | null;
  description: string;
  compatibility: string;
  colors: string[];
};

export type CustomerReview = {
  id: string;
  display_name: string;
  rating: number;
  title: string;
  body: string;
  created_at: string;
  product: { name: string; slug: string };
};

function mapRow(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    collection: row.collection,
    price: row.price_cents / 100,
    stock: row.stock,
    image: row.image_url,
    images: [row.image_url, ...(row.image_urls ?? [])].filter((image, index, list) => list.indexOf(image) === index),
    badge: row.badge ?? undefined,
    description: row.description,
    compatibility: row.compatibility,
    colors: row.colors ?? [],
  };
}

export async function getCatalog(): Promise<{ items: Product[]; demo: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { items: products, demo: true };
  const { data, error } = await supabase
    .from("products")
    .select("id,slug,name,category,collection,price_cents,stock,image_url,image_urls,badge,description,compatibility,colors")
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load the product catalog: ${error.message}`);
  return { items: (data as ProductRow[]).map(mapRow), demo: false };
}

export async function getPublishedReviews(productId?: string): Promise<CustomerReview[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase
    .from("product_reviews")
    .select("id,display_name,rating,title,body,created_at,products!inner(name,slug,active)")
    .eq("published", true)
    .eq("products.active", true)
    .order("created_at", { ascending: false })
    .limit(6);
  if (productId) query = query.eq("product_id", productId);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load customer reviews: ${error.message}`);
  return (data ?? []).flatMap((row) => {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    if (!product) return [];
    return [{
      id: row.id,
      display_name: row.display_name,
      rating: row.rating,
      title: row.title,
      body: row.body,
      created_at: row.created_at,
      product: { name: product.name, slug: product.slug },
    }];
  });
}
