-- تشخیص دو چکِ قرمزِ پروداکشن (۸ و ۲۱) — فقط خواندنی
--   railway run psql "$DATABASE_URL" -f scripts/diag.sql
\pset pager off
\pset border 2

\echo '── الف) چک ۸: سطرهای معیوب demo_after + دو سطر قبل و بعدشان ──'
WITH run AS (
  SELECT id, player_id, created_at, kind, ref, amount, demo, demo_after,
         SUM(demo) OVER (PARTITION BY player_id ORDER BY id) AS demo_run,
         row_number() OVER (PARTITION BY player_id ORDER BY id)  AS rn
    FROM wallet_ledger
), bad AS (
  SELECT player_id, rn FROM run WHERE round(demo_after,6) <> round(demo_run,6)
), win AS (
  SELECT DISTINCT r.* FROM run r JOIN bad b
    ON b.player_id = r.player_id AND r.rn BETWEEN b.rn - 2 AND b.rn + 2
)
SELECT rn, id, player_id AS pl, to_char(created_at,'MM-DD HH24:MI:SS') AS ts,
       kind, left(COALESCE(ref,''),16) AS ref,
       amount, demo, demo_after,
       round(demo_run,6) AS "باید_باشد",
       round(demo_after - demo_run,6) AS "اختلاف",
       CASE WHEN round(demo_after,6) <> round(demo_run,6) THEN '❌' ELSE '' END AS x
  FROM win ORDER BY player_id, rn;

\echo ''
\echo '── ب) چک ۲۱: بازار(های) بدون settled_at ──'
SELECT id, status, outcome, void_reason, creator_id AS creator, bettors,
       yes_total, no_total,
       to_char(created_at,'MM-DD HH24:MI') AS "ساخته",
       to_char(closes_at,'MM-DD HH24:MI')  AS "بسته‌شدن",
       left(question,50) AS "سؤال"
  FROM ir_markets
 WHERE status IN ('settled','void') AND settled_at IS NULL;

\echo ''
\echo '── ج) وضعیت کل بازارها (زمینه) ──'
SELECT status, count(*),
       count(*) FILTER (WHERE settled_at IS NOT NULL) AS "دارای settled_at",
       SUM(bettors) AS "شرکت‌کننده", round(SUM(yes_total+no_total),2) AS "استخر"
  FROM ir_markets GROUP BY status ORDER BY 2 DESC;
