import StoreShell from "@/components/store-shell";
import { ShopPage } from "@/components/storefront";
import { getCatalog } from "@/lib/store-data";

export default async function Shop({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ items, demo }, params] = await Promise.all([getCatalog(), searchParams]);
  return <StoreShell><ShopPage products={items} initialSearch={params.q ?? ""} demo={demo} /></StoreShell>;
}
