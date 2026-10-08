import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "音乐相册 · 腾讯音乐高校 AI Hackathon",
  description: "用 AI 把校园记忆整理成一张会讲故事的音乐相册。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
