import type { Metadata } from "next";
import localFont from "next/font/local";
import { Vazirmatn, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const estedad = localFont({
  src: "../fonts/estedad-vf.woff2",
  weight: "100 900",
  variable: "--font-estedad",
  display: "swap",
});

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazir",
  display: "swap",
});

const jbMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jbmono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "نارمون | معامله‌گری الگوریتمیک با اثبات زنده",
  description:
    "ربات معامله‌گر نارمون، تحلیل بازارهای مالی و معرفی بروکر — با نتایج شفاف و قابل راستی‌آزمایی، نه وعده.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body
        className={`${estedad.variable} ${vazirmatn.variable} ${jbMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
