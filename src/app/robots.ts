import type { MetadataRoute } from "next";

const SITE_URL = "https://tradevault.yashkumarvaibhav.me";

export default function robots(): MetadataRoute.Robots {
  // The public marketing + auth pages are crawlable; the gated app and APIs are not (and gated
  // routes redirect unauthenticated requests to /login anyway).
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
