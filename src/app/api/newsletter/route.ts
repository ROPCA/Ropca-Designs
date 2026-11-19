import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Newsletter signup is unavailable until store setup is complete." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid signup request." }, { status: 400 }); }
  const email = typeof body === "object" && body !== null && "email" in body && typeof body.email === "string"
    ? body.email.trim().toLowerCase()
    : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const { error } = await supabase.from("newsletter_subscribers").upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
  if (error) {
    console.error("Newsletter signup failed.", error.message);
    return NextResponse.json({ error: "We couldn't save your signup. Please try again later." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
