import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function adminClient() {
  const supabase = await createClient();
  if (!supabase) return { response: NextResponse.json({ error: "Store backend is not configured." }, { status: 503 }) };
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Sign in to continue." }, { status: 401 }) };
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profileError || profile?.role !== "admin") return { response: NextResponse.json({ error: "Administrator access is required." }, { status: 403 }) };
  return { supabase, user };
}

export async function GET() {
  const auth = await adminClient();
  if ("response" in auth) return auth.response;
  const [products, orders, customers, requests, reviews, settings] = await Promise.all([
    auth.supabase.from("products").select("*").order("created_at", { ascending: false }),
    auth.supabase.from("orders").select("*,order_items(product_name,quantity,variant,unit_price_cents)").order("created_at", { ascending: false }).limit(100),
    auth.supabase.from("profiles").select("id,email,full_name,created_at").order("created_at", { ascending: false }).limit(200),
    auth.supabase.from("custom_requests").select("*").order("created_at", { ascending: false }).limit(100),
    auth.supabase.from("product_reviews").select("*,products(name,slug)").order("created_at", { ascending: false }).limit(200),
    auth.supabase.from("store_settings").select("key,value"),
  ]);
  for (const result of [products, orders, customers, requests, reviews, settings]) {
    if (result.error) {
      console.error("Admin dashboard data query failed.", result.error.message);
      return NextResponse.json({ error: "Some admin data could not be loaded. Please refresh the dashboard." }, { status: 502 });
    }
  }
  const pendingRequests = requests.data ?? [];
  const withReferences = await Promise.all(pendingRequests.map(async (request) => {
    if (!request.reference_path) return { ...request, reference_url: null };
    const { data, error } = await auth.supabase.storage.from("custom-references").createSignedUrl(request.reference_path, 300);
    if (error) {
      console.error("Could not create custom reference preview.", error.message);
      return { ...request, reference_url: null };
    }
    return { ...request, reference_url: data.signedUrl };
  }));
  return NextResponse.json({
    products: products.data,
    orders: orders.data,
    customers: customers.data,
    requests: withReferences,
    reviews: reviews.data,
    settings: Object.fromEntries((settings.data ?? []).map(({ key, value }) => [key, value])),
  });
}
