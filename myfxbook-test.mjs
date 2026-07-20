#!/usr/bin/env node
// اسکریپت تست Myfxbook API — لوکال روی مک خودت اجرا کن.
// پسورد و ایمیل را به‌صورت متغیر محیطی می‌دهی، نه داخل کد و نه در چت.
//
// نحوه‌ی اجرا (در ترمینال، داخل پوشه‌ی پروژه):
//   MYFXBOOK_EMAIL="ایمیلت" MYFXBOOK_PASSWORD="پسوردت" node myfxbook-test.mjs
//
// خروجی امن است: پسورد و session و لینک‌های دعوت را چاپ نمی‌کند.
// فقط ساختار داده را نشان می‌دهد تا بر اساسش کد نهایی را بنویسیم.

const EMAIL = process.env.MYFXBOOK_EMAIL;
const PASSWORD = process.env.MYFXBOOK_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("❌ لطفاً MYFXBOOK_EMAIL و MYFXBOOK_PASSWORD را ست کن.");
  console.error('مثال: MYFXBOOK_EMAIL="you@mail.com" MYFXBOOK_PASSWORD="xxx" node myfxbook-test.mjs');
  process.exit(1);
}

const BASE = "https://www.myfxbook.com/api";

function redact(obj) {
  // حذف فیلدهای حساس از خروجی
  const clone = JSON.parse(JSON.stringify(obj));
  const strip = (o) => {
    if (o && typeof o === "object") {
      for (const k of Object.keys(o)) {
        if (/session|password|invitationUrl|email/i.test(k)) o[k] = "‹hidden›";
        else strip(o[k]);
      }
    }
  };
  strip(clone);
  return clone;
}

async function main() {
  // 1) login
  const loginUrl = `${BASE}/login.json?email=${encodeURIComponent(EMAIL)}&password=${encodeURIComponent(PASSWORD)}`;
  const loginRes = await fetch(loginUrl);
  const login = await loginRes.json();
  if (login.error) {
    console.error("❌ خطای لاگین:", login.message);
    process.exit(1);
  }
  const session = login.session;
  console.log("✅ لاگین موفق بود. session گرفته شد.\n");

  // 2) get-my-accounts
  const accRes = await fetch(`${BASE}/get-my-accounts.json?session=${encodeURIComponent(session)}`);
  const acc = await accRes.json();
  if (acc.error) {
    console.error("❌ خطای دریافت حساب‌ها:", acc.message);
    process.exit(1);
  }

  console.log("=== لیست حساب‌ها (بدون اطلاعات حساس) ===");
  const accounts = acc.accounts ?? [];
  console.log(`تعداد حساب: ${accounts.length}\n`);

  for (const a of accounts) {
    console.log("─".repeat(50));
    console.log("id (شناسه Myfxbook):", a.id);
    console.log("accountId (شماره حساب):", a.accountId);
    console.log("name:", a.name);
    console.log("gain:", a.gain, "%");
    console.log("absGain:", a.absGain, "%");
    console.log("daily:", a.daily, "%");
    console.log("monthly:", a.monthly, "%");
    console.log("drawdown:", a.drawdown, "%");
    console.log("balance:", a.balance);
    console.log("equity:", a.equity);
    console.log("profit:", a.profit);
    console.log("deposits:", a.deposits);
    console.log("withdrawals:", a.withdrawals);
    console.log("currency:", a.currency);
    console.log("demo:", a.demo);
    console.log("profitFactor:", a.profitFactor);
    console.log("pips:", a.pips);
    console.log("firstTradeDate:", a.firstTradeDate);
    console.log("lastUpdateDate:", a.lastUpdateDate);
    console.log("server:", a.server?.name);
  }
  console.log("─".repeat(50));

  // 3) get-data-daily برای اولین حساب (برای رسم منحنی)
  if (accounts.length) {
    const id = accounts[0].id;
    const end = new Date().toISOString().slice(0, 10);
    const start = "2024-01-01";
    const dailyRes = await fetch(
      `${BASE}/get-data-daily.json?session=${encodeURIComponent(session)}&id=${id}&start=${start}&end=${end}`
    );
    const daily = await dailyRes.json();
    console.log("\n=== نمونه‌ی دیتای روزانه (برای منحنی) ===");
    if (daily.error) {
      console.log("خطا:", daily.message);
    } else {
      const points = daily.dataDaily ?? [];
      console.log("تعداد نقاط:", Array.isArray(points) ? points.length : "ساختار متفاوت");
      console.log("ساختار خام (۳ نمونه‌ی اول):");
      console.log(JSON.stringify(redact(points).slice?.(0, 3) ?? points, null, 2));
    }
  }

  console.log("\n✅ تست کامل شد. این خروجی را (بدون هیچ پسوردی) برای من بفرست.");
}

main().catch((e) => {
  console.error("❌ خطای غیرمنتظره:", e.message);
  process.exit(1);
});
