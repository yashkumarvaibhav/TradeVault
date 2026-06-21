import type { MetadataRoute } from "next";

const SITE_URL = "https://tradevault.yashkumarvaibhav.me";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/features`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/faq`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/signup`, lastModified, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/login`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
