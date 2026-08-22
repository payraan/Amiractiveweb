-- ═══════════════════════════════════════════════════════════════════════
-- تولید داده‌ی مصنوعی برای تست بار
--
--   psql "$LOCAL_DB" -v users=1000 -f scripts/loadtest-seed.sql
--
-- ⚠️⚠️ **این اسکریپت روی هر دیتابیسی جز محلی، خودش را متوقف می‌کند.**
-- یک اسکریپت تولید داده که بتواند روی پروداکشن اجرا شود، دیر یا زود
-- اجرا می‌شود. نگهبان پایین عمدا اولین دستور فایل است.
--
-- پاک‌کردن: scripts/loadtest-clean.sql
-- ═══════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

DO $guard$
BEGIN
  -- دو شرط، هر دو لازم:
  --   • نام دیتابیس دقیقا `narmoon`
  --   • سرور یا سوکت یونیکس باشد یا لوپ‌بک — یعنی روی همین ماشین
  -- پروداکشن روی هاست راه‌دور است و هر دو شرط را رد می‌کند.
  IF current_database() <> 'narmoon'
     OR (inet_server_addr() IS NOT NULL
         AND NOT (inet_server_addr() <<= inet '127.0.0.0/8'
                  OR inet_server_addr() = inet '::1')) THEN
    RAISE EXCEPTION
      'فقط دیتابیس محلی narmoon. دیتابیس: %  ·  سرور: %',
      current_database(), COALESCE(host(inet_server_addr()), 'unix-socket');
  END IF;
END
$guard$;

\echo '── ساخت کاربران ──'

-- کاربران. همه با پیشوند zzload تا پاک‌کردنشان قطعی باشد.
INSERT INTO players (tg_username, display_name, password_hash, tg_user_id,
                     tg_linked_at, terms_at, credits, demo_balance, created_at)
SELECT
  'zzload' || i,
  'کاربر آزمایشی ' || i,
  'x',
  700000000 + i,
  now() - (i % 60) * interval '1 day',
  now() - (i % 60) * interval '1 day',
  10 + (i % 40),
  100,
  now() - (i % 60) * interval '1 day'
FROM generate_series(1, :users) i;

-- دفترکل متناظر — بدون این، چک سلامت ۱ و ۲ می‌شکنند و تست روی
-- حالتی اجرا می‌شود که خودش خراب است.
INSERT INTO wallet_ledger (player_id, amount, kind, ref, balance_after, demo, demo_after, created_at)
SELECT p.id, 100, 'demo_allowance', to_char(p.created_at, 'YYYY-MM'), 0, 100, 100, p.created_at
FROM players p WHERE p.tg_username LIKE 'zzload%';

\echo '── ساخت بازارها ──'

-- یک بازار به‌ازای هر ۲۵ کاربر، با سازنده‌های مختلف.
INSERT INTO ir_markets (creator_id, question, category, source_note, closes_at,
                        status, fee_usdt, created_at)
SELECT
  p.id,
  'بازار آزمایشی ' || p.id || ' — آیا شاخص تا پایان هفته بالای حد می‌ماند؟',
  (ARRAY['economy','sports','crypto','politics','social'])[1 + (p.id % 5)],
  'منبع آزمایشی',
  now() + ((p.id % 20) + 1) * interval '6 hours',
  'open', 0,
  now() - (p.id % 30) * interval '1 day'
FROM players p
WHERE p.tg_username LIKE 'zzload%' AND p.id % 25 = 0;

\echo '── ساخت پیش‌بینی‌ها (بازار ایران) ──'

-- هر کاربر روی یک بازار شرط می‌بندد. `early_cut` طبق همان قاعده‌ی کد:
-- ده شرط‌بند اول هر بازار.
WITH mk AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn,
         count(*) OVER () AS total
    FROM ir_markets WHERE question LIKE 'بازار آزمایشی%'
), pl AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn FROM players WHERE tg_username LIKE 'zzload%'
), pairs AS (
  SELECT pl.id AS player_id,
         mk.id AS market_id,
         row_number() OVER (PARTITION BY mk.id ORDER BY pl.id) AS seat,
         CASE WHEN pl.rn % 2 = 0 THEN 'yes' ELSE 'no' END AS side
    FROM pl JOIN mk ON mk.rn = 1 + (pl.rn % GREATEST(mk.total,1))
)
INSERT INTO ir_bets (market_id, player_id, side, stake, demo_stake,
                     creator_cut, creator_cut_demo, early_cut, early_cut_demo, status, created_at)
SELECT market_id, player_id, side, 5, 5,
       round(5 * 0.015, 6), round(5 * 0.015, 6),
       CASE WHEN seat <= 10 THEN round(5 * 0.009, 6) ELSE 0 END,
       CASE WHEN seat <= 10 THEN round(5 * 0.009, 6) ELSE 0 END,
       'open', now() - (seat % 10) * interval '1 hour'
FROM pairs;

-- جمع‌های بازار باید با شرط‌ها بخوانند (چک ۳ و ۴ و ۴۰).
UPDATE ir_markets m SET
  yes_total = s.y, no_total = s.n, bettors = s.b,
  creator_cut = s.c, creator_cut_demo = s.cd,
  early_cut = s.e, early_cut_demo = s.ed
FROM (
  SELECT market_id,
         COALESCE(SUM(stake) FILTER (WHERE side='yes'),0) AS y,
         COALESCE(SUM(stake) FILTER (WHERE side='no'),0)  AS n,
         count(DISTINCT player_id) AS b,
         SUM(creator_cut) AS c, SUM(creator_cut_demo) AS cd,
         SUM(early_cut) AS e,   SUM(early_cut_demo) AS ed
    FROM ir_bets GROUP BY market_id
) s WHERE m.id = s.market_id;

-- موجودی کاربران باید خرجشان را نشان بدهد.
UPDATE players p SET demo_balance = 100 - x.spent
FROM (SELECT player_id, SUM(stake) AS spent FROM ir_bets GROUP BY player_id) x
WHERE p.id = x.player_id AND p.tg_username LIKE 'zzload%';

INSERT INTO wallet_ledger (player_id, amount, kind, ref, balance_after, demo, demo_after, created_at)
SELECT b.player_id, -b.stake, 'ir_bet', 'm' || b.market_id, 0, -b.stake,
       100 - SUM(b.stake) OVER (PARTITION BY b.player_id ORDER BY b.id), b.created_at
FROM ir_bets b JOIN players p ON p.id = b.player_id
WHERE p.tg_username LIKE 'zzload%';

\echo '── ساخت رویدادهای رفتاری ──'

INSERT INTO app_events (player_id, kind, surface, game, market_id, category, created_at)
SELECT p.id,
       (ARRAY['list_view','market_open','market_open','predict'])[1 + (p.id % 4)],
       (ARRAY['site','app'])[1 + (p.id % 2)],
       (ARRAY['iran','trade','pulse'])[1 + (p.id % 3)],
       'm' || (1 + p.id % 40),
       (ARRAY['economy','sports','crypto','politics'])[1 + (p.id % 4)],
       now() - (p.id % 30) * interval '1 day' - (p.id % 24) * interval '1 hour'
FROM players p WHERE p.tg_username LIKE 'zzload%';

\echo '── آمار نهایی ──'
SELECT
  (SELECT count(*) FROM players     WHERE tg_username LIKE 'zzload%') AS "کاربر",
  (SELECT count(*) FROM ir_markets  WHERE question LIKE 'بازار آزمایشی%') AS "بازار",
  (SELECT count(*) FROM ir_bets)     AS "شرط",
  (SELECT count(*) FROM wallet_ledger) AS "دفترکل",
  (SELECT count(*) FROM app_events)  AS "رویداد";
