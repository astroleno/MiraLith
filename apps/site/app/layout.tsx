import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ChapterTransitionProvider } from "../components/chapter-transition/ChapterTransitionProvider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://miralith.vercel.app"),
  title: "MiraLith",
  openGraph: {
    title: "MiraLith",
    type: "website"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#080a10"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <ChapterTransitionProvider>{children}</ChapterTransitionProvider>
      </body>
    </html>
  );
}
