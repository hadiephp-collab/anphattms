import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const font = Be_Vietnam_Pro({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ["vietnamese", "latin"],
  variable: "--font-main",
});

export const metadata: Metadata = {
  title: "An Phát TMS",
  description: "Hệ thống quản lý An Phát",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${font.variable} h-full`}>
      <body className={`min-h-full flex flex-col ${font.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
