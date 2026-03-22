import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "dbcode — Module Deep Dive",
  description: "각 TS 모듈의 내부 구조를 코드 레벨에서 이해하기",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
