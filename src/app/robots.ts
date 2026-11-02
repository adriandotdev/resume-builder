import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Noindex pages stay crawlable so search engines can read their noindex tag.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
