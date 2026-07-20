import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// تست موقت اتصال Myfxbook از روی سرور Railway (جایی که Cloudflare مشکلی ندارد).
// با هدر  x-settle-key: <SETTLE_KEY>  صدا زده می‌شود (همان کلیدی که قبلاً ساختی).
// ایمیل/پسورد از متغیرهای محیطی خوانده می‌شوند، نه از کد.
// خروجی امن است: پسورد و session و لینک دعوت را برنمی‌گرداند.

const BASE = "https://www.myfxbook.com/api";

function redact<T>(value: T): T {
  const clone = JSON.parse(JSON.stringify(value));
  const strip = (o: unknown) => {
    if (o && typeof o === "object") {
      for (const k of Object.keys(o as Record<string, unknown>)) {
        if (/session|password|invitationUrl|email/i.test(k)) {
          (o as Record<string, unknown>)[k] = "‹hidden›";
        } else {
          strip((o as Record<string, unknown>)[k]);
        }
      }
    }
  };
  strip(clone);
  return clone;
}

export async function GET(req: Request) {
  const key = process.env.SETTLE_KEY;
  if (!key || req.headers.get("x-settle-key") !== key) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const email = process.env.MYFXBOOK_EMAIL;
  const password = process.env.MYFXBOOK_PASSWORD;
  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "missing_env", hint: "MYFXBOOK_EMAIL / MYFXBOOK_PASSWORD را در Railway ست کن" },
      { status: 400 }
    );
  }

  try {
    // 1) login
    const loginRes = await fetch(
      `${BASE}/login.json?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
    );
    const login = await loginRes.json();
    if (login.error) {
      return NextResponse.json({ ok: false, step: "login", message: login.message });
    }
    const session = login.session;

    // 2) accounts
    const accRes = await fetch(
      `${BASE}/get-my-accounts.json?session=${session}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
    );
    const acc = await accRes.json();
    if (acc.error) {
      return NextResponse.json({ ok: false, step: "accounts", message: acc.message });
    }

    const accounts = (acc.accounts ?? []).map((a: Record<string, unknown>) => ({
      id: a.id,
      accountId: a.accountId,
      name: a.name,
      gain: a.gain,
      absGain: a.absGain,
      daily: a.daily,
      monthly: a.monthly,
      drawdown: a.drawdown,
      balance: a.balance,
      equity: a.equity,
      profit: a.profit,
      deposits: a.deposits,
      withdrawals: a.withdrawals,
      currency: a.currency,
      demo: a.demo,
      profitFactor: a.profitFactor,
      pips: a.pips,
      firstTradeDate: a.firstTradeDate,
      lastUpdateDate: a.lastUpdateDate,
      server: (a.server as { name?: string })?.name,
    }));

    // 3) daily sample for the first account
    let dailySample: unknown = null;
    if (accounts.length) {
      const id = accounts[0].id;
      const end = new Date().toISOString().slice(0, 10);
      const dailyRes = await fetch(
        `${BASE}/get-data-daily.json?session=${session}&id=${id}&start=2024-01-01&end=${end}`,
        { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
      );
      const daily = await dailyRes.json();
      const points = daily.dataDaily ?? daily;
      dailySample = {
        error: daily.error ?? false,
        message: daily.message ?? null,
        count: Array.isArray(points) ? points.length : "non-array",
        first3: Array.isArray(points) ? redact(points.slice(0, 3)) : redact(points),
      };
    }

    return NextResponse.json({
      ok: true,
      accountsCount: accounts.length,
      accounts,
      dailySample,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "fetch_failed" },
      { status: 500 }
    );
  }
}
