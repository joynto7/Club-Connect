import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yourdomain.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/events", "/clubs"],
        disallow: ["/admin", "/settings", "/api"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
