import type { Metadata } from "next";
import { Navigation } from "@/components/Navigation";
import { Sidebar } from "@/components/Sidebar";
import { BackToTop } from "@/components/BackToTop";
import { ScrollProgress } from "@/components/ScrollProgress";
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
      <body className="min-h-full flex flex-col" style={{ background: "#ffffff" }}>
        <a href="#main-content" className="skip-link">콘텐츠로 건너뛰기</a>
        <ScrollProgress />
        <Navigation />
        <BackToTop />
        <div className="layout-with-sidebar" style={{ paddingTop: "var(--nav-height)" }}>
          <Sidebar />
          <div className="sidebar-content">
            <main id="main-content">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
