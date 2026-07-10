import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/org";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/sign-up`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/sign-in`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
