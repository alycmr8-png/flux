/**
 * The site's own canonical origin.
 *
 * Needed by robots.txt, the sitemap, and every canonical and OpenGraph URL — all of
 * which have to be absolute. Falls back to the production domain rather than a
 * relative path, because a relative OpenGraph image simply does not render when
 * Instagram or iMessage fetches the link.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://ucorns.com").replace(/\/+$/, "");
