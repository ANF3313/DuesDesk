import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/org";

/**
 * Search engines may index the marketing page — never the app or,
 * critically, members' private pay links.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/pay/",
          "/dashboard",
          "/units",
          "/invoices",
          "/announcements",
          "/settings",
          "/onboarding",
          "/api/",
        ],
      },
    ],
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
