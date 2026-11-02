import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/templates", "/editor", "/privacy", "/about", "/contact"].map((path) => ({ url: `${SITE_URL}${path}` }));
}
