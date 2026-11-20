import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "사건조사서 작성 툴",
  description: "사건 서류에서 자료를 찾아 사건조사서 초안으로 모아 주는 도구",
};

// 인터넷 없이도 빌드·실행되도록 외부 글꼴(Google Fonts)을 쓰지 않고 시스템 글꼴을 쓴다.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
