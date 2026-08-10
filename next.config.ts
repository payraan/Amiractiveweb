import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            // مینی‌اپ باید داخل قاب تلگرام باز شود، پس نمی‌شود قاب‌شدن را
            // کامل بست. ولی تا امروز هیچ محدودیتی نبود و *هر* سایتی می‌توانست
            // کل پلتفرم — از جمله کیف پول و پنل ادمین — را داخل iframe بگذارد
            // و روی کلیک‌های کاربر سوار شود (clickjacking).
            //
            // کلاینت‌های موبایل و دسکتاپ تلگرام WebView بومی‌اند و اصلا تابع
            // این هدر نیستند؛ این فقط تلگرام وب را مجاز می‌کند و بقیه را
            // می‌بندد.
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org https://telegram.org",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
