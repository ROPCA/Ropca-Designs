import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const statuses = new Set(["invoice_pending", "invoice_sent", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Store backend is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  let parsed: unknown;
  try { parsed = await request.json(); } catch { return NextResponse.json({ error: "Invalid order update." }, { status: 400 }); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return NextResponse.json({ error: "Invalid order update." }, { status: 400 });
  const body = parsed as { status?: unknown; tracking_number?: unknown; invoice_number?: unknown };
  if (typeof body.status !== "string" || !statuses.has(body.status) ||
      (body.tracking_number !== undefined && (typeof body.tracking_number !== "string" || body.tracking_number.length > 120)) ||
      (body.invoice_number !== undefined && (typeof body.invoice_number !== "string" || body.invoice_number.length > 80))) {
    return NextResponse.json({ error: "Enter a valid order status, invoice number, and tracking number." }, { status: 400 });
  }
  const { error } = await supabase.rpc("admin_update_invoice_order", {
    p_order_id: id,
    p_status: body.status,
    p_invoice_number: typeof body.invoice_number === "string" ? body.invoice_number.trim() || null : null,
    p_tracking_number: typeof body.tracking_number === "string" ? body.tracking_number.trim() || null : null,
  });
  if (error) {
    console.error("Order status could not be updated.", error.message);
    if (error.message.includes("ORDER_NOT_FOUND") || error.message.includes("ORDER_CANCELLED")) {
      return NextResponse.json({ error: "That order no longer exists or has already been cancelled." }, { status: 409 });
    }
    return NextResponse.json({ error: "Couldn't update the order." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
