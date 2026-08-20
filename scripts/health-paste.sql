-- ═══════════════════════════════════════════════════════════════════════
-- کوئری‌های سلامت نارمون — همه باید ۰ برگردانند
--
-- اجرا:  psql "$DATABASE_URL" -f scripts/health.sql
--
-- بخش الف = شش کوئری رسمی HANDOFF-7 §۵
-- بخش ب  = چک‌های افزوده (یکپارچگی دفترکل، درگاه، بازار، بازی‌ها)
--
-- مقادیر مجاز که این چک‌ها بر آن‌ها تکیه دارند (از خود کد استخراج شده‌اند،
-- نه حدس — اگر در کد عوض شدند این فایل هم باید عوض شود):
--   ir_markets.status : pending · open · locked · settling · settled · void
--   ir_bets.status    : open · won · lost · refunded
--   withdrawals.status: requested · submitted · completed · failed · stuck
--   wallet_ledger.kind: فهرست LEDGER_LABEL در src/lib/ledger-labels.ts
--   دفترکلِ واریز  ref = gateway_deposits.txid
--   دفترکلِ برداشت ref = withdrawals.unique_param
-- ═══════════════════════════════════════════════════════════════════════

SELECT n, CASE WHEN c = 0 THEN 'OK' ELSE '❌ FAIL' END AS result, c AS bad_rows, name
FROM (

-- ─── بخش الف: شش کوئری رسمی ─────────────────────────────────────────────

SELECT 1 AS n, 'موجودی (واقعی+دمو) = جمع دفترکل' AS name, (SELECT count(*) FROM (
  SELECT p.id FROM players p LEFT JOIN wallet_ledger w ON w.player_id=p.id
  GROUP BY p.id, p.usdt_balance, p.demo_balance
  HAVING p.usdt_balance + p.demo_balance <> COALESCE(SUM(w.amount),0)) x) AS c
UNION ALL
SELECT 2, 'موجودی دمو = جمع ستون demo دفترکل', (SELECT count(*) FROM (
  SELECT p.id FROM players p LEFT JOIN wallet_ledger w ON w.player_id=p.id
  GROUP BY p.id, p.demo_balance
  HAVING p.demo_balance <> COALESCE(SUM(w.demo),0)) x)
UNION ALL
SELECT 3, 'استخر بازار = مجموع پیش‌بینی‌ها  ← مهم‌ترین', (SELECT count(*) FROM (
  SELECT m.id FROM ir_markets m LEFT JOIN ir_bets b ON b.market_id=m.id
  GROUP BY m.id, m.yes_total, m.no_total
  HAVING m.yes_total <> COALESCE(SUM(b.stake) FILTER (WHERE b.side='yes'),0)
      OR m.no_total  <> COALESCE(SUM(b.stake) FILTER (WHERE b.side='no'),0)) x)
UNION ALL
SELECT 4, 'سهم سازنده = جمع سهم تک‌تک شرط‌ها', (SELECT count(*) FROM (
  SELECT m.id FROM ir_markets m LEFT JOIN ir_bets b ON b.market_id=m.id
  GROUP BY m.id, m.creator_cut
  HAVING round(m.creator_cut,6) <> round(COALESCE(SUM(b.creator_cut),0),6)) x)
UNION ALL
SELECT 5, 'سهم دمو هرگز از اصل بیشتر نباشد',
  (SELECT count(*) FROM ir_bets WHERE demo_stake > stake)
UNION ALL
SELECT 6, 'هیچ موجودی منفی نباشد',
  (SELECT count(*) FROM players WHERE usdt_balance < 0 OR demo_balance < 0)

-- ─── بخش ب: یکپارچگی دفترکل ─────────────────────────────────────────────

UNION ALL
-- ⚠️ `amount` مبلغ کل است و `demo` سهم دمو از همان مبلغ. پس موجودی واقعی
-- برابر جمع تجمعیِ (amount - demo) است، نه جمع تجمعی amount.
SELECT 7, 'balance_after با جمع تجمعی (amount - demo) می‌خواند', (SELECT count(*) FROM (
  SELECT balance_after, SUM(amount - demo) OVER (PARTITION BY player_id ORDER BY id) AS run
  FROM wallet_ledger) t WHERE round(balance_after,6) <> round(run,6))
UNION ALL
SELECT 8, 'demo_after با جمع تجمعی demo می‌خواند', (SELECT count(*) FROM (
  SELECT demo_after, SUM(demo) OVER (PARTITION BY player_id ORDER BY id) AS run
  FROM wallet_ledger) t WHERE round(demo_after,6) <> round(run,6))
UNION ALL
SELECT 9, 'سطر دفترکل بدون بازیکن (یتیم)',
  (SELECT count(*) FROM wallet_ledger w
   WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id=w.player_id))
UNION ALL
SELECT 10, 'نوع تراکنش ناشناخته در دفترکل',
  (SELECT count(*) FROM wallet_ledger WHERE kind NOT IN (
    'deposit','withdraw_hold','withdraw_refund','ir_bet','ir_payout','ir_refund',
    'ir_propose_fee','ir_propose_refund','ir_boost','ir_creator_share',
    'ir_early_share','bonus_code','credit_purchase','admin_adjust'))
UNION ALL
SELECT 11, 'پول دموی منفی در یک سطر بستانکار',
  (SELECT count(*) FROM wallet_ledger WHERE demo > amount AND amount > 0)

-- ─── بخش ب: درگاه پرداخت (پول واقعی) ────────────────────────────────────

UNION ALL
SELECT 12, 'واریزِ credited بدون سطر دفترکل  ← پول گم‌شده',
  (SELECT count(*) FROM gateway_deposits d WHERE d.credited
   AND NOT EXISTS (SELECT 1 FROM wallet_ledger w WHERE w.kind='deposit' AND w.ref=d.txid))
UNION ALL
SELECT 13, 'txid تکراری در واریزها  ← واریز دوباره‌حساب‌شده',
  (SELECT count(*) FROM (SELECT txid FROM gateway_deposits GROUP BY txid HAVING count(*)>1) x)
UNION ALL
SELECT 14, 'برداشت فعال بدون withdraw_hold در دفترکل',
  (SELECT count(*) FROM withdrawals wd WHERE wd.status IN ('requested','submitted','completed')
   AND NOT EXISTS (SELECT 1 FROM wallet_ledger w WHERE w.kind='withdraw_hold' AND w.ref=wd.unique_param))
UNION ALL
SELECT 15, 'unique_param تکراری در برداشت‌ها  ← نقض idempotency',
  (SELECT count(*) FROM (SELECT unique_param FROM withdrawals GROUP BY unique_param HAVING count(*)>1) x)
UNION ALL
SELECT 16, 'وضعیت برداشت ناشناخته',
  (SELECT count(*) FROM withdrawals WHERE status NOT IN ('requested','submitted','completed','failed','stuck'))

-- ─── بخش ب: بازار ایران ─────────────────────────────────────────────────

UNION ALL
SELECT 17, 'وضعیت بازار ناشناخته',
  (SELECT count(*) FROM ir_markets WHERE status NOT IN ('pending','open','locked','settling','settled','void'))
UNION ALL
SELECT 18, 'وضعیت پیش‌بینی ناشناخته',
  (SELECT count(*) FROM ir_bets WHERE status NOT IN ('open','won','lost','refunded'))
UNION ALL
SELECT 19, 'side غیر از yes/no',
  (SELECT count(*) FROM ir_bets WHERE side NOT IN ('yes','no'))
UNION ALL
SELECT 20, 'بازار settled بدون outcome',
  (SELECT count(*) FROM ir_markets WHERE status='settled' AND outcome IS NULL)
UNION ALL
-- ⚠️ بازارِ ردشده (pending → void در ir-moderation.ts) عمدا settled_at ندارد:
-- هرگز تسویه نشده که زمان تسویه داشته باشد. پس فقط بازاری که واقعا پول
-- داشته و به وضعیت نهایی رسیده باید مهر زمان داشته باشد.
SELECT 21, 'بازارِ پولدارِ نهایی‌شده بدون settled_at',
  (SELECT count(*) FROM ir_markets WHERE status IN ('settled','void') AND settled_at IS NULL
     AND (bettors > 0 OR yes_total + no_total > 0))
UNION ALL
SELECT 22, 'پیش‌بینیِ open روی بازارِ تسویه‌شده  ← گیرکرده',
  (SELECT count(*) FROM ir_bets b JOIN ir_markets m ON m.id=b.market_id
   WHERE b.status='open' AND m.status IN ('settled','void'))
UNION ALL
SELECT 23, 'پیش‌بینیِ تسویه‌شده بدون payout',
  (SELECT count(*) FROM ir_bets WHERE status IN ('won','lost','refunded') AND payout IS NULL)
UNION ALL
SELECT 24, 'جمع پرداختی > کل استخر  ← پول از هوا ساخته شده', (SELECT count(*) FROM (
  SELECT m.id FROM ir_markets m JOIN ir_bets b ON b.market_id=m.id
  WHERE m.status IN ('settled','void')
  GROUP BY m.id, m.yes_total, m.no_total
  HAVING COALESCE(SUM(b.payout),0) > m.yes_total + m.no_total + 0.000001) x)
UNION ALL
SELECT 25, 'creator_cut_demo > creator_cut', (SELECT count(*) FROM (
  SELECT id FROM ir_markets WHERE creator_cut_demo > creator_cut
  UNION ALL SELECT id FROM ir_bets WHERE creator_cut_demo > creator_cut) x)
UNION ALL
SELECT 26, 'شمارنده‌ی bettors با تعداد واقعی نمی‌خواند', (SELECT count(*) FROM (
  SELECT m.id FROM ir_markets m LEFT JOIN ir_bets b ON b.market_id=m.id
  GROUP BY m.id, m.bettors
  HAVING m.bettors <> COALESCE(count(DISTINCT b.player_id),0)) x)
UNION ALL
SELECT 27, 'مبلغ پیش‌بینی زیر حداقل (۱ تتر)',
  (SELECT count(*) FROM ir_bets WHERE stake < 1)
UNION ALL
SELECT 28, 'استخر پر ولی bettors صفر',
  (SELECT count(*) FROM ir_markets WHERE yes_total + no_total > 0 AND bettors = 0)

-- ─── بخش ب: نبض بازار / آرنا / کمبو ─────────────────────────────────────

UNION ALL
SELECT 29, 'راند تسویه‌شده بدون settle_price',
  (SELECT count(*) FROM rounds WHERE status='settled' AND settle_price IS NULL)
UNION ALL
SELECT 30, 'vol_scale بیرون از بازه‌ی مجاز [۰.۰۵ , ۸.۰]',
  (SELECT count(*) FROM rounds WHERE vol_scale IS NOT NULL AND (vol_scale < 0.05 OR vol_scale > 8.0))
UNION ALL
SELECT 31, 'پیش‌بینی امتیازدار روی راندِ تسویه‌نشده',
  (SELECT count(*) FROM predictions p JOIN rounds r ON r.id=p.round_id
   WHERE p.points IS NOT NULL AND r.status <> 'settled')
UNION ALL
SELECT 32, 'legs_count کمبو با تعداد واقعی نمی‌خواند', (SELECT count(*) FROM (
  SELECT t.id FROM combo_tickets t LEFT JOIN combo_legs l ON l.ticket_id=t.id
  GROUP BY t.id, t.legs_count HAVING t.legs_count <> count(l.id)) x)
UNION ALL
SELECT 33, 'پیش‌بینی آرنا تسویه‌شده بدون امتیاز',
  (SELECT count(*) FROM poly_predictions WHERE status IN ('won','lost') AND points IS NULL)

-- ─── بخش ب: بازیکن‌ها و ضدتقلب ──────────────────────────────────────────

UNION ALL
SELECT 34, 'referral_code تکراری',
  (SELECT count(*) FROM (SELECT referral_code FROM players WHERE referral_code IS NOT NULL
   GROUP BY referral_code HAVING count(*)>1) x)
UNION ALL
SELECT 35, 'tg_user_id تکراری  ← دو حساب روی یک تلگرام',
  (SELECT count(*) FROM (SELECT tg_user_id FROM players WHERE tg_user_id IS NOT NULL
   GROUP BY tg_user_id HAVING count(*)>1) x)
UNION ALL
SELECT 36, 'بازیکنی که خودش را دعوت کرده',
  (SELECT count(*) FROM players WHERE referred_by = id)
UNION ALL
SELECT 37, 'referred_by به بازیکن ناموجود',
  (SELECT count(*) FROM players p WHERE p.referred_by IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM players q WHERE q.id=p.referred_by))
UNION ALL
SELECT 38, 'کد بونوس بیش از سقف استفاده شده',
  (SELECT count(*) FROM bonus_codes WHERE used > max_uses)
UNION ALL
SELECT 39, 'دریافت دوباره‌ی یک کد بونوس توسط یک نفر',
  (SELECT count(*) FROM (SELECT code, player_id FROM bonus_redemptions
   GROUP BY code, player_id HAVING count(*)>1) x)

-- ─── سهم نفرات اول ──────────────────────────────────────────────────────

UNION ALL
SELECT 40, 'سهم نفرات اول = جمع سهم تک‌تک شرط‌ها', (SELECT count(*) FROM (
  SELECT m.id FROM ir_markets m LEFT JOIN ir_bets b ON b.market_id=m.id
  GROUP BY m.id, m.early_cut
  HAVING round(m.early_cut,6) <> round(COALESCE(SUM(b.early_cut),0),6)) x)
UNION ALL
SELECT 41, 'سهم دموی نفرات اول از اصلش بیشتر نباشد', (SELECT count(*) FROM (
  SELECT id FROM ir_markets WHERE early_cut_demo > early_cut
  UNION ALL SELECT id FROM ir_bets WHERE early_cut_demo > early_cut) x)
UNION ALL
-- ⚠️ مهم‌ترین نگهبان اقتصادی این قابلیت: سهم نفرات اول کسری از کمیسیون
-- است (۳۰٪ × ۳٪)، پس هرگز نباید از خودِ کمیسیون بیشتر شود. اگر بشود،
-- پلتفرم روی آن بازار ضرر کرده — چیزی که طبق طراحی ناممکن است، و
-- ناممکن‌ها همان‌هایی‌اند که باید سنجیده شوند.
SELECT 42, 'سهم نفرات اول از کمیسیون بیشتر نشود  ← ضرر پلتفرم',
  (SELECT count(*) FROM ir_markets
    WHERE early_cut > (yes_total + no_total) * 0.03 + 0.000001)

) checks ORDER BY n;
