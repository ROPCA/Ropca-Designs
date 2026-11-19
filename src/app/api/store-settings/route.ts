import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const defaults = { free_shipping_threshold_cents: 15000, standard_shipping_cents: 995 };
const defaultEmail = "hello@ropcadesigns.com";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json(defaults);
  const { data, error } = await supabase.from("store_settings").select("key,value").in("key", [...Object.keys(defaults), "store_email"]);
  if (error) {
    console.error("Store shipping settings could not be loaded.", error.message);
    return NextResponse.json({ error: "Shipping estimates are temporarily unavailable." }, { status: 502 });
  }
  const values = Object.fromEntries((data ?? []).map((item) => [item.key, item.value]));
  const threshold = Number(values.free_shipping_threshold_cents);
  const shipping = Number(values.standard_shipping_cents);
  return NextResponse.json({
    free_shipping_threshold_cents: Number.isFinite(threshold) ? threshold : defaults.free_shipping_threshold_cents,
    standard_shipping_cents: Number.isFinite(shipping) ? shipping : defaults.standard_shipping_cents,
    store_email: typeof values.store_email === "string" ? values.store_email : defaultEmail,
  });
}
