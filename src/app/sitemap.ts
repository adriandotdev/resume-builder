import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ["", "/templates", "/editor"].map((path) => ({ url: `${SITE_URL}${path}`, lastModified }));
}
