import type { Metadata } from "next";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import localFont from "next/font/local";
import { NoiseBackground } from "@/components/noise-background";
import { GlobalErrorListener } from "@/components/global-error-listener";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-display",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
});

const satoshi = localFont({
  src: [
    {
      path: "../public/fonts/Satoshi-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/Satoshi-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/Satoshi-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "TENSIENT",
  description:
    "Your team generates noise. We extract signal. Every thought measured against your goals. Alignment scored.",
  openGraph: {
    title: "TENSIENT",
    description:
      "Your team generates noise. We extract signal. Every thought measured against your goals.",
    url: "https://tensient.com",
    siteName: "Tensient",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TENSIENT",
    description:
      "Your team generates noise. We extract signal. Every thought measured against your goals.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${spaceMono.variable} ${satoshi.variable}`}
    >
      <body className="bg-background text-foreground font-body antialiased">
        <NoiseBackground />
        <div className="relative z-10">{children}</div>
        <GlobalErrorListener />
        <Analytics />
      </body>
    </html>
  );
}
