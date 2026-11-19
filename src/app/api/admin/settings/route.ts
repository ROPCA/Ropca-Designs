import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PUT(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Store backend is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid settings." }, { status: 400 }); }
  const threshold = Number(body.free_shipping_threshold_cents);
  const shipping = Number(body.standard_shipping_cents);
  const email = body.store_email;
  if (!Number.isInteger(threshold) || threshold < 0 || threshold > 1_000_000 ||
      !Number.isInteger(shipping) || shipping < 0 || shipping > 100_000 ||
      typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid shipping threshold, shipping price, and store email." }, { status: 400 });
  }
  const entries = [
    { key: "free_shipping_threshold_cents", value: String(threshold) },
    { key: "standard_shipping_cents", value: String(shipping) },
    { key: "store_email", value: email.trim().toLowerCase() },
  ];
  const { error } = await supabase.from("store_settings").upsert(entries, { onConflict: "key" });
  if (error) {
    console.error("Store settings could not be updated.", error.message);
    return NextResponse.json({ error: "Couldn't save store settings." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
