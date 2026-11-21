import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://oya-build.vercel.app"),
  applicationName: "Oya Build",
  openGraph: { siteName: "Oya Build", type: "website" },
  twitter: { card: "summary_large_image" },
  title: "Oya Build: floor plan to 3D and a Naira estimate",
  description: "Photograph a floor plan, walk through it in 3D, and get a bill of quantities in Naira. Move a wall and watch both update.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
