import type { Metadata } from "next";
import SiteDemoBanner from "@/components/SiteDemoBanner";
import { modeBanner } from "@/lib/platform-mode";
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
  // بدون این، Next آدرس‌های نسبیِ تصویر OG را نسبت به localhost حل می‌کند و
  // پیش‌نمایش اشتراک‌گذاری بازارهای ایران روی تلگرام و شبکه‌ها می‌شکند.
  metadataBase: new URL(
    process.env.SITE_URL?.trim() ||
      "https://amiractiveweb-production.up.railway.app"
  ),
  title: "نارمون | معامله‌گری الگوریتمیک با اثبات زنده",
  description:
    "ربات معامله‌گر نارمون، تحلیل بازارهای مالی و معرفی بروکر، با نتایج شفاف و قابل راستی‌آزمایی، نه وعده.",
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
        {/* ⚠️ در لایوت ریشه و نه کنار هر `<Nav />`: Nav در پانزده صفحه
            جداگانه صدا زده می‌شود و صفحه‌ای که بنر نداشته باشد، دقیقا
            همان صفحه‌ای است که کاربر فکر می‌کند پولش واقعی است.
            `modeBanner()` سمت سرور خوانده می‌شود — همان تک‌منبع حقیقت،
            نه یک NEXT_PUBLIC موازی که روزی با آن نخوانَد. */}
        <SiteDemoBanner notice={modeBanner()} />
        {children}
      </body>
    </html>
  );
}
