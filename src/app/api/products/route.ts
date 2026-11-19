import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/store-data";

export async function GET() {
  try {
    const catalog = await getCatalog();
    return NextResponse.json(catalog);
  } catch (error) {
    console.error("Product catalog API failed.", error);
    return NextResponse.json({ error: "The product catalog is temporarily unavailable." }, { status: 502 });
  }
}
