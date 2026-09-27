import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * The public pages, so Google can find them without following links.
 *
 * A new domain has nothing pointing at it, so there is no path for a crawler to
 * discover anything but the homepage. This is the list — dashboard routes are
 * excluded because they are behind auth.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/download`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
