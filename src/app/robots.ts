import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ropcadesigns.com";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/api", "/checkout"] },
    sitemap: `${siteUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}
