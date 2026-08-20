# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # dev server (localhost:3000)
npm run build    # production build
npm run lint     # eslint
```

There is no test suite. `myfxbook-test.mjs` in the root is a standalone probe script for the Myfxbook API, run manually with `node myfxbook-test.mjs`.

## What this is

Persian-language (Farsi, RTL — `lang="fa" dir="rtl"` in the root layout) site for the "نارمون" (Narmoon) trading bot by amiractive. It combines a marketing landing page with a prediction-gaming platform. Code comments and UI copy are largely in Persian; follow that convention. Deployed on Railway.

Stack: Next.js 16 App Router, React 19, Tailwind v4 (via PostCSS), TypeScript, raw SQL via `pg` (no ORM). Path alias `@/*` → `src/*`.

## Architecture

### Database and migrations

`src/lib/db.ts` owns a global Postgres pool. `db()` returns the pool after running an idempotent schema block (CREATE TABLE IF NOT EXISTS + ALTER ... ADD COLUMN IF NOT EXISTS) once per cold start — there is no migration framework. Feature modules own their extra tables the same way (`ensureIrTables()` in `iran.ts`, `ensureTelegramTables()` in `telegram.ts`, wallet tables in `iran.ts`). New schema changes must be idempotent SQL added to these blocks. SSL is auto-detected from the DATABASE_URL host (local/`.internal` hosts get no SSL); `PGSSL=off` is the escape hatch.

### Auth (fail-closed)

- Player sessions: HMAC-signed `playerId.expiry.sig` cookie (`amir_session`), `src/lib/session.ts`. `SESSION_SECRET` is required; without it every session is rejected and login fails loudly. Never add a fallback secret — a guessable secret means forgeable sessions (this was a real bug, see file comments).
- Passwords: scrypt via Node crypto, `src/lib/auth.ts`. Usernames are Telegram handles, normalized lowercase without `@`.
- Admin: separate 12h HMAC cookie (`amir_admin`), `src/lib/admin.ts`, keyed by `ADMIN_SECRET` (falls back to `SESSION_SECRET`), also fail-closed.
- Telegram bot endpoints (`/api/bot/*`) authenticate with the `BOT_API_KEY` header instead of cookies.

### API route pattern

All routes live under `src/app/api/*/route.ts` and follow the same shape: `export const dynamic = "force-dynamic"`, read cookie via `await cookies()`, `verifySession(...)` → 401, validate body → 400, respond `NextResponse.json({ ok, ... })` with error codes as short snake_case strings (`not_authed`, `bad_asset`, `market_closed`).

### Game domains (three separate economies)

1. **Predict** (`/predict`, `/api/predict/*`): price-guessing game on ~42 assets across 4 timeframes. Rounds/predictions/credits in Postgres. `src/lib/game.ts` is the single source of truth for economy numbers (costs, welcome credits, calibrated scoring tables) — it is imported by both client and server, so it must stay free of server-only dependencies. Settlement is idempotent (`src/lib/settle.ts`, triggered via `/api/predict/settle`). Scoring is deliberately zero-expectation: blind guessing loses points, so buying credits can't buy rank — preserve this property when touching scoring.
2. **Arena / Polymarket** (`/arena`, `src/lib/poly.ts`): event-prediction game fed by Polymarket's Gamma API, zero-EV scoring (win = +(100−prob%), loss = −prob%). Points, not money.
3. **Iran markets** (`/iran`, `src/lib/iran.ts`): real-money (USDT) parimutuel betting pools on self-created, human-moderated markets. Market lifecycle: `pending → open → locked → settling → settled | void`. Markets void (full refund, no commission) if winner odds drop below `MIN_ODDS`. This is the only domain with real money — be conservative here.

### Wallet

USDT deposits/withdrawals through the Zovix crypto gateway (`src/lib/zovix.ts`): HMAC-SHA256-signed form-urlencoded requests — the signed string must be byte-identical to the sent body, so never switch it to JSON. Deposits confirmed via signed webhook (`/api/wallet/webhook`). Balances tracked in `players.usdt_balance` with an append-only `wallet_ledger`.

### Upstream data is always proxied server-side

Yahoo Finance candles (`src/lib/candles.ts`), Polymarket (`poly.ts`), and Myfxbook stats (`myfxbook.ts`) are fetched by the server with in-memory TTL caches. This is intentional: Iranian visitors must never hit those upstreams directly (sanctions/blocking). Don't move these fetches to the client.

### Asset catalog

`src/lib/assets.ts` — asset ids are stored in the database; never rename an id, only add new ones.

### Config

`src/config/site.ts` holds all marketing content (plans, pricing, FAQs, social links). Campaign/pricing changes are meant to touch only this file.

## Environment variables

`DATABASE_URL`, `SESSION_SECRET` (required), `ADMIN_SECRET`, `PGSSL`, `SETTLE_KEY`, `ZOVIX_BASE_URL`/`ZOVIX_API_KEY`/`ZOVIX_API_SECRET`/`ZOVIX_USDT_NETWORK`, `BOT_TOKEN`/`BOT_USERNAME`/`BOT_API_KEY`/`GROUP_ID`/`SITE_URL`, `MYFXBOOK_ACCOUNT_ID` (+ Myfxbook credentials).

---

# سند راه‌اندازی پروژه (خلاصه‌ی تصمیم‌ها از چت‌های قبلی — افزوده‌شده ۲۰۲۶/۰۸/۰۸)

این بخش خلاصه‌ی چند ماه کار و تصمیم‌گیری در چت‌های claude.ai است. **منبع حقیقت نهایی، خود ریپو است** — هر جا این سند با کد فعلی تناقض داشت، کد را ملاک بگیر و تناقض را به مالک پروژه گزارش بده.

## ۱. پروژه چیست

- نام برند: نارمون (Narmoon) — پلتفرم فارسی «پیش‌بینی مهارتی» بازارهای مالی.
- ریپو: https://github.com/payraan/Amiractiveweb (برنچ main)
- دیپلوی: Railway — آدرس فعلی: https://amiractiveweb-production.up.railway.app (دامنه‌ی اصلی هنوز وصل نشده)
- بدون فریم‌ورک انیمیشن سنگین (framer-motion و three.js عمداً رد شده‌اند — حجم باندل، SEO، مخاطب ایران).
- تز محصول: «امتیاز فقط از مهارت می‌آید، نه شانس و نه پول.» امتیاز خریدنی نیست؛ پاداش بر اساس رتبه است.
- مالک پروژه در استانبول است، مخاطب اصلی کاربر داخل ایران است — این دوگانه در همه‌ی تصمیم‌های حقوقی، فیلترینگ و geo-blocking اثر دارد.

## ۲. محصولات سایت (ترتیب اولویت در لندینگ)

1. آرنای پیش‌بینی (`/arena`) — بازارهای بله/خیر با دیتای زنده‌ی پالی‌مارکت. فرمول امتیاز صفر-انتظار: «۱۰۰ منهای احتمالِ قفل‌شده در لحظه‌ی ثبت» (برد روی گزینه‌ی ۱۰٪ = +۹۰، باخت = −۱۰). چلنج پراپ هم اینجاست.
2. نبض بازار (`/predict`) — پیش‌بینی قیمت (کریپتو/فارکس/فلزات/سهام) در تایم‌فریم‌های ۱س/۴س/۱۲س/۲۴س. آستانه‌ها با نوسان هر دارایی و تایم‌فریم مقیاس می‌شوند (`vol_scale`). قانون: قوانین وسط راند عوض نمی‌شوند.
3. ربات اسکلپر — محصول جانبی؛ نباید هم‌رده‌ی پیام اصلی دیده شود.
4. بروکر — قیف IB؛ سکشن بروکر + CTA طلایی «فعال‌سازی ربات» در هیرو + Myfxbook زنده.

سایر: کمبو (`/combos`)، رفرال (`/referral`)، لاگین، کردیت، لیدربورد، قوانین/سلب مسئولیت، لینک پشتیبانی و کانال تلگرام.

## ۳. بازار ایران — قلب استراتژیک پلتفرم (⚠️ ناتمام، اولویت بالا)

چرا: بازارهای پالی‌مارکت («نامزد دموکرات‌ها ۲۰۲۸») برای کاربر ایرانی بی‌معنی است. فرض راهبردی: بازارهای ایرانی تفاوت بین کارکردن و کارنکردن محصول است. این بخش کاملاً مجزا از پالی‌مارکت است و مهم‌ترین بخش پلتفرم از نظر مالک است.

**مدل دو-بازاره (شفاف‌سازی مالک، ۲۰۲۶/۰۸/۰۸):**

1. **بازار خارجی** (پالی‌مارکت): اقتصاد کردیتی — پیش‌بینی رایگان با محدودیت + خرید کردیت برای پیش‌بینی بیشتر. چلنج پراپ مخصوص همین بخش است.
2. **بازار داخلی (ایران)**: اقتصاد پول واقعی — کیف پول شخصی تتر برای هر کاربر (درگاه Zovix)، شرط‌بندی با تتر در استخر parimutuel با کمیسیون (پیاده‌سازی فعلی `iran.ts` **عمدی و مصوب** است). کاربر بازار می‌سازد، بازارها کتگوری دارند، و پنل ترید باید عیناً مشابه پنل بازار خارجی باشد. ربات/مینی‌اپ تلگرام آینده هم روی همین زیرساخت و دیتابیس مشترک سوار می‌شود (ثبت کاربر تلگرامی = همان حساب پلتفرم).

### دامنه‌ی فاز یک (~۱۵ دارایی، غیرسیاسی)

- ارز آزاد: دلار، یورو، پوند، درهم، لیر
- طلا: ۱۸ عیار، ۲۴ عیار، مثقال، انس جهانی
- سکه: امامی، بهار آزادی، نیم، ربع، گرمی
- بورس: شاخص کل، شاخص هم‌وزن
- رمزارز به تومان: تتر
- ⚠️ **منسوخ (۲۹ مرداد ۱۴۰۵):** این خط می‌گفت «ورزش و آب‌وهوا عمداً فاز
  دو». ورزش از همان اول دسته داشت و بازارهایش ساخته شده‌اند، و دسته‌ی
  `politics` هم با تصمیم مالک اضافه شد. قاعده‌ی محتوایی معتبر در
  `HANDOFF-7.md` §۶ است، نه اینجا.

### بازار کاربرساخته (مصوب)

- کاربر با کردیت بازار می‌سازد (پیشنهاد بازار = ۱۰۰ کردیت)، تأیید انسانی می‌گیرد، منتشر می‌شود. شرط‌بندی روی بازارِ منتشرشده با تتر واقعی است (استخر parimutuel — بخش بالا).
- نقدینگی لازم نیست: خودِ جمعیت قیمت را می‌سازد — استخر دو طرف، احتمال و ضریب را تعیین می‌کند.
- ضد دستکاری: تا حداقل مشارکت (~۲۰ نفر) بازار «در حال شکل‌گیری» می‌ماند و تسویه نمی‌شود.
- پاداش سازنده: سهم ~۱۰٪ از کردیتی که روی بازارش خرج می‌شود (مدل درآمد یوتیوب — خودتأمین، از استخر پلتفرم خرج نمی‌شود).
- اکسپلور و ترند: رتبه‌بندی بر اساس سرعت رشد مشارکت (نه تعداد کل) — بازارهای داغ بالا می‌آیند.
- بوست: سازنده با کردیت بازارش را به صدر اکسپلور می‌آورد (پله‌های پیشنهادی: ۵۰ کردیت/۶ ساعت، ۱۵۰/۲۴س، ۴۰۰/۷۲س) — درآمد خالص پلتفرم و چاه کردیت.
- اهرم رایگان و برابر: سهمیه‌ی ماهانه‌ی ثابت، خریدنی نیست (شبیه‌سازی نشان داد اهرم خریدنی + جایزه‌ی صدرمحور = خرید جایزه با پول).

### اوراکل و تسویه (سخت‌ترین بخش)

- منبع تسویه در لحظه‌ی ساخت اجباری (URL عمومی + عدد مشخص + تاریخ مشخص). بازار مبهم رد می‌شود.
- بازبینی انسانی قبل از انتشار؛ پنجره‌ی اعتراض ۲۴ ساعته بعد از تسویه؛ اوراکل غیرمتمرکز به بعد موکول شد.
- منابع قیمت ایرانی: BrsApi.ir (رایگان تا ۱۵۰۰ درخواست/روز)، Nerkh.io (رایگان)، Navasan (اشتراکی).
- ⚠️ ریسک بحرانی تست‌نشده: سرور Railway خارج از ایران است و این APIها برای مصرف داخل ایران‌اند — ممکن است از خارج کند/مسدود باشند. قبل از هر ساخت بیشتری، اول probe route (موجود: `/api/predict/ir-probe` محافظت‌شده با `x-settle-key`) را از Railway اجرا کن و تأخیر/پایداری/پوشش هر منبع را بسنج.

## ۴. کیف پول و درگاه کریپتویی

- درگاه کریپتویی Zovix (متعلق به نزدیکان مالک → ریسک قطع سرویس کم). کلاینت، وبهوک و صفحه‌ی کیف پول در کد ساخته شده (`src/lib/zovix.ts`).
- قابلیت‌های هدف: کیف پول درون‌پلتفرمی برای هر کاربر؛ واریز/برداشت تتر و رمزارزهای دیگر؛ خرید خودکار کردیت؛ پرداخت خودکار جوایز؛ اشتراک خودکار ربات و ورودی چلنج؛ کمیسیون خودکار.
- UI خرید کردیت (مصوب): به‌جای کارت‌های عددی، اسلایدر درصدی بر اساس موجودی تتر کیف پول (مثل انتخاب اهرم در صرافی‌ها)، از حداقل ۱ تتر (یا ۴ — هنوز قطعی نشده) تا سقف موجودی.
- پروفایل کاربر باید بازطراحی شود: موجودی، تاریخچه‌ی تراکنش، کارنامه‌ی عمومی قابل اشتراک، نشان‌ها، نوار پیشرفت تا پاداش بعدی، جایگاه رتبه‌ی درصدی.
- اصل طراحی: «فرض کن اتوماسیون پرداخت وجود دارد و برای دنیای پس از اتوماسیون طراحی کن، نه وضع فعلی.»

## ۵. اقتصاد پاداش و خط قرمزها (تصمیم قطعی — تغییر نده)

**آنچه ساخته نمی‌شود:** هر مکانیزمی که در آن پول واقعی از بازنده به برنده منتقل شود و پلتفرم کمیسیون بردارد — شامل روم خصوصی با شرط نقدی، تبدیل مستقیم نتیجه‌ی پیش‌بینی به تتر، و استخر جایزه‌ای که از ورودی‌های همان بازی تأمین شود (توتالیزاتور). دلیل: تعریف حقوقی قمار، ریسک کیفری روی کاربر ایرانی، بسته‌شدن درگاه پرداخت، و مرگ مسیر پراپ/بروکر.

> ⚠️ **استثنای مصوب مالک (۲۰۲۶/۰۸/۰۸):** استخر parimutuel تتری بازار ایران (`iran.ts`) با تصمیم صریح مالک ساخته شده و این خط قرمز شامل آن نمی‌شود. خط قرمز بالا برای بازی‌های کردیتی/امتیازی (بازار خارجی، نبض بازار، چلنج پراپ) و مکانیزم‌های نقدی خارج از بازار ایران برقرار است. اگر تناقضی دیدی، به‌جای استناد به این سند از مالک بپرس.

**مسیر مصوب درآمد و پاداش:**

- استخر پاداش تتری از بودجه‌ی بازاریابی (درصدی از فروش کردیت + اسپانسر)، توزیع بر اساس رتبه‌ی درصدی.
- معماری ساده‌ی «۶۰٪ برنده»: هر ماه ۶۰ پیش‌بینی اول شمرده می‌شود ← مجموع امتیاز = رتبه ← ۶۰٪ برتر از استخر می‌گیرند (نسبت جایزه‌ی صدر به ته ≈ ۱۰ برابر؛ استخر ≈ ۳۰٪ درآمد).
- مکمل‌ها: رفرال نقدی، نقطه‌ی عطف فعالیتی، اقتصاد سازنده (سهم سازنده‌ی بازار و سهم ادمین کانال).
- آینده (بعد از ۳ ماه داده‌ی واقعی): «بازار استعداد» — فروش اشتراک تحلیل بر اساس کارنامه‌ی تأییدشده، با کمیسیون پلتفرم.

**سایر خطوط قرمز:** ادعای «سود تضمینی» هرگز؛ وعده‌ی «از پیش‌بینی پول دربیار» در پیام برند هرگز؛ ایردراپ/توکن نه؛ یوزر و لیدربورد فیک نه؛ صفحه‌ی شفافیت با استدلال عددی («حدس تصادفی به‌طور میانگین امتیاز منفی می‌گیرد») حفظ شود.

## ۶. زیرساخت اتصال تلگرام (ساخته شده، غیرفعال)

- جدول `tg_link_codes` (کد یک‌بارمصرف ۱۵ دقیقه‌ای)، فیلدهای `tg_user_id`/`tg_linked_at`/`group_bonus_at` روی `players`، لینک عمیق `?start=link_<code>`، روت‌های `/api/bot/link` و `/api/bot/group` با احراز `BOT_API_KEY`، پاداش عضویت گروه (`getChatMember` → ۲۰ کردیت).
- ⚠️ متغیرهای محیطی (`BOT_USERNAME`, `BOT_TOKEN`, `BOT_API_KEY`, `GROUP_ID`, `SITE_URL`) در Railway ست نشده‌اند → قابلیت غیرفعال است.
- ⚠️ ثبت‌نام فعلی فقط یوزرنیم+رمز است، بدون اعتبارسنجی واقعی تلگرام → چندحسابی ممکن است. (ضد تقلبِ همه‌ی مکانیزم‌های پاداش به «حساب تلگرام‌وصل‌شده» گره خورده — این باید بسته شود.)

## ۷. نکات امنیتی (از ممیزی قبلی)

- ادمین: کلید جدا، fail-closed. رمز عبور: scrypt.
- کسر کردیت داخل ترنزاکشن با `SELECT … FOR UPDATE`.
- Rate limit مبتنی بر حافظه در middleware (با هر دیپلوی ریست می‌شود).
- تسویه با `SETTLE_KEY` محافظت می‌شود ولی تنبل است (فقط با باز شدن صفحات بازی اجرا می‌شود) — کرون هنوز ست نشده.

## ۸. فاز بعدی: ربات + مینی‌اپ POLL تلگرام (بعد از تثبیت سایت)

- یک سیستم، نه دو سیستم: همان دیتابیس، همان حساب، همان امتیاز، همان کیف پول. حساب و کیف پول واقعی از دل خود ربات ساخته می‌شود — ربات پنجره‌ی کامل پلتفرم است.
- مکانیزم: ادمین کانال/گروه ربات را ادمین می‌کند؛ سؤال پیش‌بینی با دکمه‌های شیشه‌ای (inline keyboard/callback_query) فرستاده می‌شود، نه poll بومی تلگرام (poll بومی هویت رأی‌دهنده را نمی‌دهد؛ callback_query آیدی عددی را می‌دهد و به حساب وصل می‌شود).
- موتور رشد: ادمین‌ها سهم سازنده (درآمد واقعی) + محتوای تعاملی روزانه می‌گیرند.
- ضد تقلب از روز اول: تعامل فقط از حساب‌های تلگرام‌وصل‌شده با حداقل سابقه؛ سقف درآمد ماهانه‌ی سازنده؛ بازبینی دستی بالای آستانه.
- توییتر و استوری اینستاگرام فقط قیف ترافیک‌اند (رأی‌شان ناشناس است، حلقه‌ی امتیاز بسته نمی‌شود).
- تا تکمیل و تثبیت سایت این فاز شروع نشود.

## ۹. کارهای باقی‌مانده (backlog به ترتیب)

1. حل مشکل دیپلوی Railway (لایو عقب‌تر از main است) + ممیزی کدهای اخیر
2. دیباگ نهایی صفحه‌ی اول
3. تکمیل بازار ایران (بخش ۳): probe اوراکل از Railway → موتور تسویه‌ی خودکار دارایی‌های ایرانی → اکسپلور/ترند/بوست → پاداش سازنده → کرون تسویه
4. دامنه‌ی اصلی + Cloudflare (Cloudflare Registrar، پروکسی روشن، Custom Domain در Railway) + متمرکزسازی لینک‌های هاردکد در کانفیگ
5. ست‌کردن env اتصال تلگرام + بستن حفره‌ی چندحسابی (اعتبارسنجی تلگرام در ثبت‌نام)
6. کیف پول و درگاه کریپتویی (بخش ۴): اسلایدر خرید کردیت، بازطراحی پروفایل، اتوماسیون پاداش/کمیسیون
7. نهایی‌سازی اقتصاد چلنج پراپ (ورودی ~۵ تتر vs جایزه‌ی ۱۰۰۰ دلاری — قبل از لانچ عمومی)
8. ربات/مینی‌اپ POLL (بخش ۸)، سپس آکادمی و ابزار تحلیل ژورنال

## ۱۰. سبک همکاری با مالک پروژه (مهم)

- مالک برنامه‌نویس نیست؛ در سطح کپی‌پیست و اجرای دستور ترمینال کار می‌کند. همه‌چیز قدم‌به‌قدم: در هر پاسخ فقط یک مرحله، بعد از تست و تأیید او مرحله‌ی بعد.
- قبل از هر کامیت: `npx tsc --noEmit`؛ در تغییرات بزرگ `npm run build`.
- هر تغییر را قبل از اعمال با یکی-دو جمله‌ی ساده به فارسی توضیح بده (چی، چرا).
- کامیت‌های کوچک با پیام مشخص؛ پوش فقط بعد از تأیید مالک.
- هیچ کلید/توکنی هاردکد نشود؛ `.env.local` در گیت‌ایگنور بماند.
- پاسخ‌ها به فارسی. اگر چیزی در کدبیس با این سند نمی‌خواند، اول گزارش بده، خودسرانه بازنویسی نکن.
