import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getAdmin() {
  const supabase = await createClient();
  if (!supabase) return { response: NextResponse.json({ error: "Store backend is not configured." }, { status: 503 }) };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in to continue." }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { response: NextResponse.json({ error: "Administrator access is required." }, { status: 403 }) };
  return { supabase };
}

function validate(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const item = body as Record<string, unknown>;
  const fields = ["slug", "name", "category", "image_url", "description", "compatibility"];
  if (fields.some((key) => typeof item[key] !== "string" || !(item[key] as string).trim())) return null;
  const slug = (item.slug as string).trim();
  const price = item.price_cents;
  const stock = item.stock;
  const colors = item.colors;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120 ||
      typeof price !== "number" || !Number.isInteger(price) || price < 1 || price > 100_000_000 ||
      typeof stock !== "number" || !Number.isInteger(stock) || stock < 0 ||
      !Array.isArray(colors) || colors.length > 20 || colors.some((color) => typeof color !== "string" || color.length > 50)) return null;
  if (typeof item.image_url !== "string") return null;
  let imageUrl: URL;
  try { imageUrl = new URL(item.image_url); } catch { return null; }
  const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
    : "";
  const isAllowedImage = (value: string) => {
    let url: URL;
    try { url = new URL(value); } catch { return false; }
    return url.protocol === "https:" &&
      (url.hostname === "images.unsplash.com" ||
        (url.hostname === supabaseHost && url.pathname.startsWith("/storage/v1/object/public/product-images/")));
  };
  if (!isAllowedImage(imageUrl.href)) return null;
  const imageUrls = item.image_urls;
  if (!Array.isArray(imageUrls) || imageUrls.length > 8 || imageUrls.some((value) => typeof value !== "string" || !isAllowedImage(value))) return null;
  return {
    slug,
    name: (item.name as string).trim().slice(0, 160),
    category: (item.category as string).trim().slice(0, 80),
    price_cents: price,
    stock,
    image_url: item.image_url,
    image_urls: imageUrls,
    badge: typeof item.badge === "string" && item.badge.trim() ? item.badge.trim().slice(0, 40) : null,
    description: (item.description as string).trim().slice(0, 3000),
    compatibility: (item.compatibility as string).trim().slice(0, 500),
    colors,
    collection: typeof item.collection === "string" ? item.collection.trim().slice(0, 100) : null,
    active: item.active !== false,
  };
}

export async function POST(request: Request) {
  const auth = await getAdmin();
  if ("response" in auth) return auth.response;
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Invalid product data." }, { status: 400 }); }
  const product = validate(payload);
  if (!product) return NextResponse.json({ error: "Enter valid product details, price, inventory, image URL, and color options." }, { status: 400 });
  const { data, error } = await auth.supabase.from("products").insert(product).select().single();
  if (error) {
    console.error("Product could not be created.", error.message);
    return NextResponse.json({ error: error.code === "23505" ? "That product URL is already in use." : "Couldn't save the product." }, { status: 502 });
  }
  return NextResponse.json({ product: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await getAdmin();
  if ("response" in auth) return auth.response;
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Invalid product data." }, { status: 400 }); }
  const product = validate(payload);
  const id = typeof payload === "object" && payload !== null && "id" in payload ? payload.id : null;
  if (!product || typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Enter valid product details." }, { status: 400 });
  const { data, error } = await auth.supabase.from("products").update(product).eq("id", id).select().single();
  if (error) {
    console.error("Product could not be updated.", error.message);
    return NextResponse.json({ error: error.code === "23505" ? "That product URL is already in use." : "Couldn't update the product." }, { status: 502 });
  }
  return NextResponse.json({ product: data });
}

export async function DELETE(request: Request) {
  const auth = await getAdmin();
  if ("response" in auth) return auth.response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "A valid product ID is required." }, { status: 400 });
  const { error } = await auth.supabase.from("products").update({ active: false, stock: 0 }).eq("id", id);
  if (error) {
    console.error("Product could not be removed.", error.message);
    return NextResponse.json({ error: "Couldn't remove the product." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
