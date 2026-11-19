import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ropcadesigns.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Ropca Designs — Redefine Your Ride",
  description:
    "Premium electric dirt bike graphics, precision-cut vinyl decals, and custom kits built for the way you ride.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Ropca Designs — Redefine Your Ride",
    description: "Graphics for the ones who never ride stock.",
    type: "website",
    url: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
