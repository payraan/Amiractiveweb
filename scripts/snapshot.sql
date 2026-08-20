-- ═══════════════════════════════════════════════════════════════════════
-- تصویر وضعیت دیتابیس نارمون — فقط خواندنی، هیچ چیزی را عوض نمی‌کند
--   psql "$DATABASE_URL" -f scripts/snapshot.sql
-- ═══════════════════════════════════════════════════════════════════════
\pset pager off
\pset border 2

\echo '── ۱. حجم جدول‌ها ─────────────────────────────────────────'
SELECT 'players' t, count(*) FROM players
UNION ALL SELECT 'wallet_ledger', count(*) FROM wallet_ledger
UNION ALL SELECT 'ir_markets', count(*) FROM ir_markets
UNION ALL SELECT 'ir_bets', count(*) FROM ir_bets
UNION ALL SELECT 'gateway_deposits', count(*) FROM gateway_deposits
UNION ALL SELECT 'withdrawals', count(*) FROM withdrawals
UNION ALL SELECT 'rounds', count(*) FROM rounds
UNION ALL SELECT 'predictions', count(*) FROM predictions
UNION ALL SELECT 'poly_predictions', count(*) FROM poly_predictions
UNION ALL SELECT 'combo_tickets', count(*) FROM combo_tickets
UNION ALL SELECT 'tg_outbox', count(*) FROM tg_outbox
UNION ALL SELECT 'platform_revenue', count(*) FROM platform_revenue
ORDER BY 1;

\echo ''
\echo '── ۲. پول واقعی در سیستم ──────────────────────────────────'
SELECT
  round(SUM(usdt_balance),2)  AS "موجودی واقعی کاربران",
  round(SUM(demo_balance),2)  AS "موجودی دمو",
  count(*) FILTER (WHERE usdt_balance > 0) AS "کاربر دارای موجودی"
FROM players;

SELECT
  round(COALESCE(SUM(amount) FILTER (WHERE kind='deposit'),0),2)        AS "کل واریز",
  round(COALESCE(SUM(-amount) FILTER (WHERE kind='withdraw_hold'),0),2) AS "کل برداشت",
  round(COALESCE(SUM(-amount) FILTER (WHERE kind='ir_bet'),0),2)        AS "حجم پیش‌بینی",
  round(COALESCE(SUM(amount) FILTER (WHERE kind='ir_payout'),0),2)      AS "کل پاداش"
FROM wallet_ledger;

\echo ''
\echo '── ۳. درآمد پلتفرم (به تفکیک نوع) ─────────────────────────'
SELECT kind AS "نوع", count(*) AS "تعداد",
       round(SUM(amount),2) AS "واقعی", round(SUM(demo_amount),2) AS "دمو"
FROM platform_revenue GROUP BY kind ORDER BY 3 DESC NULLS LAST;

\echo ''
\echo '── ۴. بازارهای ایران بر اساس وضعیت ────────────────────────'
SELECT status AS "وضعیت", count(*) AS "تعداد",
       round(SUM(yes_total + no_total),2) AS "کل استخر",
       SUM(bettors) AS "شرکت‌کننده"
FROM ir_markets GROUP BY status ORDER BY 2 DESC;

\echo ''
\echo '── ۵. بازارهای بازِ در حال بسته‌شدن (۷ روز آینده) ──────────'
SELECT id, left(question, 45) AS "سؤال", status AS "وضعیت",
       to_char(closes_at,'MM-DD HH24:MI') AS "بسته می‌شود",
       bettors AS "نفر", round(yes_total+no_total,2) AS "استخر"
FROM ir_markets
WHERE status IN ('pending','open','locked','settling')
ORDER BY closes_at LIMIT 20;

\echo ''
\echo '── ۶. راندهای بازِ نبض بازار (⚠️ ضریب قدیمی — HANDOFF-7 §۲) ─'
SELECT status AS "وضعیت", timeframe AS "تایم‌فریم", count(*) AS "تعداد",
       round(min(vol_scale),3) AS "کمینه ضریب", round(max(vol_scale),3) AS "بیشینه ضریب",
       to_char(min(round_date),'MM-DD') AS "قدیمی‌ترین"
FROM rounds WHERE status <> 'settled'
GROUP BY status, timeframe ORDER BY 1,2;

\echo ''
\echo '── ۷. صف تلگرام (گیرکرده = مشکل) ──────────────────────────'
SELECT status AS "وضعیت", count(*) AS "تعداد",
       to_char(min(created_at),'MM-DD HH24:MI') AS "قدیمی‌ترین"
FROM tg_outbox GROUP BY status ORDER BY 2 DESC;

\echo ''
\echo '── ۸. برداشت‌ها بر اساس وضعیت (دستی است — HANDOFF-7 §۴.۷) ──'
SELECT status AS "وضعیت", count(*) AS "تعداد", round(SUM(amount),2) AS "مبلغ",
       to_char(min(created_at),'MM-DD HH24:MI') AS "قدیمی‌ترین"
FROM withdrawals GROUP BY status ORDER BY 2 DESC;

\echo ''
\echo '── ۹. رشد کاربر (۱۴ روز اخیر) ─────────────────────────────'
SELECT to_char(created_at::date,'MM-DD') AS "روز", count(*) AS "ثبت‌نام",
       count(*) FILTER (WHERE tg_user_id IS NOT NULL) AS "تلگرام‌وصل"
FROM players WHERE created_at > now() - interval '14 days'
GROUP BY 1 ORDER BY 1;

\echo ''
\echo '── ۱۰. اتصال تلگرام (حفره‌ی چندحسابی — HANDOFF-7 §۴.۱۲) ────'
SELECT count(*) AS "کل بازیکن",
       count(*) FILTER (WHERE tg_user_id IS NOT NULL) AS "تلگرام‌وصل",
       count(*) FILTER (WHERE tg_blocked_at IS NOT NULL) AS "ربات بلاک",
       count(*) FILTER (WHERE terms_at IS NOT NULL) AS "قوانین پذیرفته"
FROM players;
