import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json({ error: "Custom requests are temporarily unavailable. Store setup is incomplete." }, { status: 503 });
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_FILE_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "Reference images must be under 5 MB." }, { status: 413 });
  }
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Invalid custom design form." }, { status: 400 }); }
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const model = String(form.get("model") ?? "").trim();
  const style = String(form.get("style") ?? "").trim();
  const color = String(form.get("color") ?? "").trim();
  const riderName = String(form.get("riderName") ?? "").trim();
  const number = String(form.get("number") ?? "").trim();
  const instructions = String(form.get("instructions") ?? "").trim();
  if (name.length < 1 || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid name and email address." }, { status: 400 });
  }
  if (!model || model.length > 100 || !style || style.length > 100 || !color || color.length > 80 || riderName.length > 80 || number.length > 8 || instructions.length > 2000) {
    return NextResponse.json({ error: "Some design brief fields are invalid or too long." }, { status: 400 });
  }
  const file = form.get("reference");
  if (file && (!(file instanceof File) || file.size > MAX_FILE_BYTES || !allowedTypes.has(file.type))) {
    return NextResponse.json({ error: "Reference images must be JPG, PNG, or WebP under 5 MB." }, { status: 400 });
  }

  const supabase = createSupabaseClient(url, serviceKey, { auth: { persistSession: false } });
  const requestCode = `RD-${crypto.randomUUID().replaceAll("-", "").slice(0, 24).toUpperCase()}`;
  let referencePath: string | null = null;
  if (file instanceof File && file.size > 0) {
    const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
    referencePath = `${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("custom-references").upload(referencePath, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      console.error("Custom reference upload failed.", error.message);
      return NextResponse.json({ error: "We couldn't upload that image. Please try again or submit without it." }, { status: 502 });
    }
  }

  const { error } = await supabase.from("custom_requests").insert({
    request_code: requestCode,
    name,
    email,
    model,
    style,
    color,
    rider_name: riderName || null,
    race_number: number || null,
    instructions: instructions || null,
    reference_path: referencePath,
  });
  if (error) {
    if (referencePath) {
      const { error: cleanupError } = await supabase.storage.from("custom-references").remove([referencePath]);
      if (cleanupError) console.error("Could not clean up an unlinked custom reference.", cleanupError.message);
    }
    console.error("Custom request could not be saved.", error.message);
    return NextResponse.json({ error: "We couldn't save your brief. Please try again shortly." }, { status: 502 });
  }
  return NextResponse.json({ reference: requestCode }, { status: 201 });
}
