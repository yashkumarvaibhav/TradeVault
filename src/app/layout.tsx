import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const SITE_URL = "https://tradevault.yashkumarvaibhav.me";
const SITE_DESCRIPTION =
  "TradeVault is a private trading journal and post-trade review workspace — honest per-currency analytics, Risk Studio, and disciplined review, with INR and USD never mixed. Free to start.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "TradeVault — private trading journal & review",
  description: SITE_DESCRIPTION,
  applicationName: "TradeVault",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "TradeVault",
    url: SITE_URL,
    title: "TradeVault — private trading journal & review",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: "TradeVault — private trading journal & review",
    description: SITE_DESCRIPTION,
  },
};

// Set the persisted theme before paint to avoid a flash of the wrong theme.
const themeInit = `(function(){try{var t=localStorage.getItem('tv-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <Script id="theme-init" strategy="beforeInteractive">{themeInit}</Script>
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
