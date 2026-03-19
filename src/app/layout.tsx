import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Starlink Atlas",
    template: "%s | Starlink Atlas",
  },
  description:
    "A cinematic live visualization of the Starlink constellation, tuned for fast telemetry, clear motion, and world-class UI.",
  applicationName: "Starlink Atlas",
  keywords: ["Starlink", "satellites", "constellation", "live map", "space"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
