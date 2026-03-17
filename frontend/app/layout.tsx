import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MirrorScore",
  description: "自拍上镜表现分析平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
