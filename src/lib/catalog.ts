export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  collection?: string | null;
  price: number;
  stock?: number;
  image: string;
  images?: string[];
  badge?: string;
  description: string;
  compatibility: string;
  colors: string[];
};

export const products: Product[] = [
  {
    id: "sample-01",
    slug: "afterburn-complete-kit",
    name: "Afterburn Complete Kit",
    category: "Complete kits",
    price: 189,
    stock: 12,
    image: "photo-1558981806-ec527fa84c39",
    images: ["photo-1558981806-ec527fa84c39", "photo-1558981403-c5f9899a28bc", "photo-1568772585407-9361f9bf3a87"],
    badge: "BEST SELLER",
    description: "High-impact, precision-cut graphic kit printed on premium outdoor cast vinyl with a durable gloss overlaminate.",
    compatibility: "Talaria Sting R / MX4 · Talaria Sting / MX3",
    colors: ["Flame", "Ice", "Stealth"],
  },
  {
    id: "sample-02",
    slug: "zero-hour-frame-kit",
    name: "Zero Hour Frame Kit",
    category: "Frame decals",
    price: 89,
    stock: 8,
    image: "photo-1558981403-c5f9899a28bc",
    images: ["photo-1558981403-c5f9899a28bc", "photo-1558981806-ec527fa84c39", "photo-1568772585407-9361f9bf3a87"],
    badge: "NEW DROP",
    description: "Aggressive, model-specific frame coverage with clean edges, saturated color, and a scuff-resistant finish.",
    compatibility: "Sur-Ron Light Bee X · Sur-Ron Light Bee S",
    colors: ["Volt", "Crimson", "Mono"],
  },
  {
    id: "sample-03",
    slug: "linework-fork-graphics",
    name: "Linework Fork Graphics",
    category: "Fork decals",
    price: 34,
    stock: 20,
    image: "photo-1568772585407-9361f9bf3a87",
    description: "A fast, clean detail for your front end. Sold as a matched left and right pair.",
    compatibility: "Talaria Sting · Sur-Ron Light Bee X",
    colors: ["Ice", "Volt", "Mono"],
  },
  {
    id: "sample-04",
    slug: "apex-rim-decals",
    name: "Apex Rim Decals",
    category: "Rim decals",
    price: 42,
    stock: 16,
    image: "photo-1558981806-ec527fa84c39",
    description: "Weather-ready rim graphics designed to hug the wheel and stay vivid ride after ride.",
    compatibility: "18 / 19 in. rims · specify wheel size at checkout",
    colors: ["Crimson", "Volt", "Ice"],
  },
  {
    id: "sample-05",
    slug: "race-number-plate-kit",
    name: "Race Number Plate Kit",
    category: "Number plates",
    price: 49,
    stock: 15,
    image: "photo-1558981403-c5f9899a28bc",
    description: "Front and side plate graphics customized with your race number and name.",
    compatibility: "Talaria Sting · Sur-Ron Light Bee · E Ride Pro",
    colors: ["Flame", "Stealth", "Ice"],
  },
  {
    id: "sample-06",
    slug: "pit-crew-sticker-pack",
    name: "Pit Crew Sticker Pack",
    category: "Accessories",
    price: 18,
    stock: 30,
    image: "photo-1568772585407-9361f9bf3a87",
    description: "A six-piece set of durable, UV-resistant Ropca marks for your toolbox, helmet, and gear.",
    compatibility: "Universal",
    colors: ["Mono", "Volt"],
  },
];

export const categories = [
  "All",
  "Complete kits",
  "Frame decals",
  "Fork decals",
  "Rim decals",
  "Number plates",
  "Accessories",
  "Custom graphics",
];

export function productImage(photo: string, width = 900) {
  if (photo.startsWith("http")) return photo;
  return `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=${width}&q=85`;
}

export function formatPrice(price: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
}

export function formatAmount(price: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}
