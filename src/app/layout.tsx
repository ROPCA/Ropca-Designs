import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ropca Designs — Redefine Your Ride",
  description:
    "Premium electric dirt bike graphics, precision-cut vinyl decals, and custom kits built for the way you ride.",
  openGraph: {
    title: "Ropca Designs — Redefine Your Ride",
    description: "Graphics for the ones who never ride stock.",
    type: "website",
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
