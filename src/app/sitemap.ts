import type { MetadataRoute } from "next";

const SITE_URL = "https://tradevault.yashkumarvaibhav.me";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/features`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/faq`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    // /login and /signup are no longer standalone pages — they redirect to the landing modal.
  ];
}
