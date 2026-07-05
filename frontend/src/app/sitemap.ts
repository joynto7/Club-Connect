import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yourdomain.com";
  const now = new Date();

  return [
    { url: siteUrl, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/events`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/clubs`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
