import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import Providers from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yourdomain.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Club Connect — University Club Management",
    template: "%s | Club Connect",
  },
  description:
    "Club Connect is the all-in-one platform for university clubs — discover events, manage memberships, and connect with your campus community.",
  keywords: ["university clubs", "student events", "campus community", "club management"],
  authors: [{ name: "Club Connect Team" }],
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Club Connect",
    title: "Club Connect — University Club Management",
    description: "Discover clubs, join events, and connect with your campus community.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Club Connect" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Club Connect",
    description: "Discover clubs, join events, and connect with your campus community.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Club Connect",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#EBA814" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          {children}
          <Toaster richColors position="top-right" closeButton />
        </Providers>
      </body>
    </html>
  );
}
