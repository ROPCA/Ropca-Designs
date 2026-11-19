import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type CartInput = { id: string; quantity: number; variant?: string | null };
type CheckoutBody = {
  checkout_request_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
  customer_note?: string;
  custom_request_code?: string;
  items?: CartInput[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cartKey = (item: CartInput) => `${item.id}:${item.variant ?? ""}`;

function invalid(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = await createClient();
  if (!url || !serviceKey || !supabase) {
    return NextResponse.json({ error: "Order submission is unavailable until the store database is configured." }, { status: 503 });
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return invalid("Invalid order request.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return invalid("Invalid order request.");
  const body = parsed as CheckoutBody;
  if (typeof body.checkout_request_id !== "string" || !UUID.test(body.checkout_request_id)) return invalid("Refresh the checkout page and try again.");
  if (typeof body.name !== "string" || body.name.trim().length < 1 || body.name.trim().length > 100) return invalid("Enter your name.");
  if (typeof body.email !== "string" || !EMAIL.test(body.email.trim()) || body.email.trim().length > 254) return invalid("Enter a valid email address.");
  if (body.phone !== undefined && (typeof body.phone !== "string" || body.phone.length > 40)) return invalid("Enter a valid phone number.");
  if (body.customer_note !== undefined && (typeof body.customer_note !== "string" || body.customer_note.length > 1000)) return invalid("Order notes must be 1,000 characters or fewer.");
  const address = body.address;
  if (!address || (["line1", "city", "region", "postal_code", "country"] as const).some((key) => {
    const value = address[key];
    return typeof value !== "string" || value.trim().length < 1 || value.trim().length > 120;
  }) || (address.line2 !== undefined && (typeof address.line2 !== "string" || address.line2.length > 120)) ||
      !["US", "CA"].includes(address.country ?? "")) {
    return invalid("Enter a complete shipping address in the United States or Canada.");
  }
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20 ||
      body.items.some((item) => !item || typeof item.id !== "string" || !UUID.test(item.id) ||
        !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99 ||
        (item.variant !== undefined && item.variant !== null && (typeof item.variant !== "string" || item.variant.length > 50)))) {
    return invalid("Your cart contains invalid items or quantities. Please refresh it and try again.");
  }
  if (new Set(body.items.map(cartKey)).size !== body.items.length) return invalid("Remove duplicate cart entries and try again.");

  if (body.custom_request_code !== undefined && typeof body.custom_request_code !== "string") return invalid("Enter a valid custom brief reference.");
  const requestCode = typeof body.custom_request_code === "string" ? body.custom_request_code.trim().toUpperCase() : "";
  if (requestCode && !/^RD-[A-F0-9]{24}$/.test(requestCode)) return invalid("Enter a valid custom brief reference.");

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("Could not verify the checkout customer session.", authError.message);
    return NextResponse.json({ error: "We couldn't verify your session. Please refresh and try again." }, { status: 401 });
  }

  const privateClient = createSupabaseClient(url, serviceKey, { auth: { persistSession: false } });
  let customRequestId: string | null = null;
  if (requestCode) {
    const { data: customRequest, error } = await privateClient
      .from("custom_requests")
      .select("id,email")
      .eq("request_code", requestCode)
      .maybeSingle();
    if (error) {
      console.error("Custom order attachment lookup failed.", error.message);
      return NextResponse.json({ error: "We couldn't verify that design brief. Please try again." }, { status: 502 });
    }
    if (!customRequest || customRequest.email.toLowerCase() !== body.email.trim().toLowerCase()) {
      return NextResponse.json({ error: "That brief could not be found, has already been attached, or is no longer available." }, { status: 404 });
    }
    customRequestId = customRequest.id;
  }

  const { data, error } = await privateClient.rpc("create_invoice_order", {
    p_checkout_request_id: body.checkout_request_id,
    p_customer_id: user?.id ?? null,
    p_name: body.name.trim(),
    p_email: body.email.trim().toLowerCase(),
    p_phone: body.phone?.trim() || null,
    p_shipping_address: {
      line1: address.line1!.trim(),
      line2: address.line2?.trim() || null,
      city: address.city!.trim(),
      region: address.region!.trim(),
      postal_code: address.postal_code!.trim(),
      country: address.country,
    },
    p_customer_note: body.customer_note?.trim() || null,
    p_custom_request_id: customRequestId,
    p_items: body.items.map(({ id, quantity, variant }) => ({ id, quantity, variant: variant || null })),
  });
  if (error) {
    console.error("Invoice order could not be created.", error.message);
    if (error.message.includes("OUT_OF_STOCK") || error.message.includes("PRODUCT_UNAVAILABLE")) {
      return NextResponse.json({ error: "An item in your cart is no longer available in the requested quantity. Please review your cart." }, { status: 409 });
    }
    if (error.message.includes("CUSTOM_BRIEF_UNAVAILABLE")) {
      return NextResponse.json({ error: "That custom brief has already been attached to another order or is no longer available." }, { status: 409 });
    }
    if (error.message.includes("INVALID_VARIANT")) return invalid("One of the selected product options is no longer available.");
    return NextResponse.json({ error: "We couldn't save your order. Please try again." }, { status: 502 });
  }
  if (!data || typeof data.order_number !== "string" || !/^RD-[A-F0-9]{12}$/i.test(data.order_number) ||
      !Number.isInteger(data.amount_total_cents) || !Number.isInteger(data.shipping_cents)) {
    console.error("Invoice order response did not contain a valid order reference.");
    return NextResponse.json({ error: "We couldn't confirm your order. Please contact the store before submitting again." }, { status: 502 });
  }
  return NextResponse.json({
    order_number: data.order_number,
    amount_total_cents: data.amount_total_cents,
    shipping_cents: data.shipping_cents,
  }, { status: 201 });
}
