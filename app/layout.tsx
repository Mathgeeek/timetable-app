import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "시간표 일과 마스터",
  description: "교사별 시수표 기반 시간표 빌더",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}