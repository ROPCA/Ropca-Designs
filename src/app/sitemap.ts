import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/store-data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://ropcadesigns.com").replace(/\/$/, "");
  const { items } = await getCatalog();
  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/custom`, changeFrequency: "monthly", priority: 0.7 },
    ...items.map((product) => ({
      url: `${siteUrl}/products/${product.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
