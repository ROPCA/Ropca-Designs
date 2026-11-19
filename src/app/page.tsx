import Storefront from "@/components/storefront";
import StoreShell from "@/components/store-shell";
import { getCatalog } from "@/lib/store-data";
import { getPublishedReviews } from "@/lib/store-data";

export default async function HomePage() {
  const [{ items, demo }, reviews] = await Promise.all([getCatalog(), getPublishedReviews()]);
  return <StoreShell><Storefront products={items} demo={demo} reviews={reviews} /></StoreShell>;
}
