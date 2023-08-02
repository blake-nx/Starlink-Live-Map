import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Map } from "../components/Map";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Starlink Map",
  description: "A map of Starlink satellites over your head",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Map />
      </body>
    </html>
  );
}
