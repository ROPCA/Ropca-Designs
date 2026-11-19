import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Customer reviews are unavailable until store setup is complete." }, { status: 503 });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to review a purchased product." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid review." }, { status: 400 }); }
  const { order_id: orderId, product_id: productId, rating, title, body: text } = body;
  if (typeof orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(orderId) ||
      typeof productId !== "string" || !/^[0-9a-f-]{36}$/i.test(productId) ||
      typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5 ||
      typeof title !== "string" || title.trim().length < 1 || title.length > 120 ||
      typeof text !== "string" || text.trim().length < 1 || text.length > 2000) {
    return NextResponse.json({ error: "Enter a rating, short title, and review of up to 2,000 characters." }, { status: 400 });
  }
  const { data: profile, error: profileError } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  if (profileError) {
    console.error("Review author profile lookup failed.", profileError.message);
    return NextResponse.json({ error: "We couldn't verify your account. Please try again." }, { status: 502 });
  }
  const displayName = profile.full_name?.trim().slice(0, 80) || user.email?.split("@")[0]?.slice(0, 80) || "Ropca rider";
  const { error } = await supabase.from("product_reviews").insert({
    order_id: orderId,
    product_id: productId,
    user_id: user.id,
    display_name: displayName,
    rating,
    title: title.trim(),
    body: text.trim(),
  });
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "You've already reviewed this product from that order." }, { status: 409 });
    console.error("Verified product review could not be saved.", error.message);
    return NextResponse.json({ error: "Couldn't submit your review. Confirm you purchased this product and try again." }, { status: 403 });
  }
  return NextResponse.json({ ok: true, message: "Thanks for sharing your ride. Your review will appear after moderation." }, { status: 201 });
}
