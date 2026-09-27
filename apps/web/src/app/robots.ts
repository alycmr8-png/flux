import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Serves /robots.txt. Without one the request 404s, and the 404 page carries
 * noindex — so a crawler's first look at the file that is supposed to invite it in
 * gets a page telling it to stay out.
 *
 * The dashboard is disallowed because it is behind auth and returns 404 to crawlers
 * anyway; listing it keeps Googlebot from spending the site's crawl budget there.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard/", "/sso-callback"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
