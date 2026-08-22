-- پاک‌کردن کامل داده‌ی تست بار. همان نگهبان اسکریپت تولید.
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

DELETE FROM ir_bets     WHERE market_id IN (SELECT id FROM ir_markets WHERE question LIKE 'بازار آزمایشی%');
DELETE FROM ir_markets  WHERE question LIKE 'بازار آزمایشی%';
DELETE FROM app_events    WHERE player_id IN (SELECT id FROM players WHERE tg_username LIKE 'zzload%');
DELETE FROM wallet_ledger WHERE player_id IN (SELECT id FROM players WHERE tg_username LIKE 'zzload%');
DELETE FROM tg_outbox     WHERE player_id IN (SELECT id FROM players WHERE tg_username LIKE 'zzload%');
DELETE FROM players       WHERE tg_username LIKE 'zzload%';

SELECT (SELECT count(*) FROM players WHERE tg_username LIKE 'zzload%') AS "کاربر تست باقی‌مانده",
       (SELECT count(*) FROM ir_markets) AS "بازار",
       (SELECT count(*) FROM ir_bets)    AS "شرط";
