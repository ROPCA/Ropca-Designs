import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Store backend is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid review." }, { status: 400 });
  let body: { published?: unknown };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "Invalid review update." }, { status: 400 }); }
  if (typeof body.published !== "boolean") return NextResponse.json({ error: "Choose whether to publish the review." }, { status: 400 });
  const { error } = await supabase.from("product_reviews").update({ published: body.published }).eq("id", id);
  if (error) {
    console.error("Review moderation failed.", error.message);
    return NextResponse.json({ error: "Couldn't update the review." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
